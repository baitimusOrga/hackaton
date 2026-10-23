package one.absent.hackaton.search;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import lombok.extern.slf4j.Slf4j;
import one.absent.hackaton.ai.AiClient;
import one.absent.hackaton.listing.Listing;
import one.absent.hackaton.listing.ListingDetail;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

/** The buying assistant: free text → requirements (one AI call), requirements → grouped matches (one AI call). */
@Slf4j
@Service
public class SearchService {

    static final List<String> ATTRIBUTES = List.of("Brand", "Model", "Year", "Color", "Size", "Display",
            "Resolution", "CPU", "RAM", "Storage", "Material", "Dimensions", "Condition");
    static final List<String> CATEGORIES = List.of("Computers", "Laptops", "Monitors", "Phones", "Tablets",
            "Office furniture", "Audio", "Cameras", "Household", "Bikes");
    static final int MAX_CANDIDATES = 30;
    static final int MAX_PER_GROUP = 10;
    static final String NO_AI_REASON = "Ranked without AI right now.";

    record Parsed(List<Requirement> mustHave, List<Requirement> niceToHave, String category,
                  List<String> keywords, BigDecimal maxBudgetChf, String postcode) {
    }

    record Ranked(List<Item> confirmed, List<Item> possible, List<Item> alternatives) {
    }

    record Item(long listingId, String reason, List<String> missingDetails, List<String> differences) {
    }

    private static final String REQUIREMENT_SCHEMA = """
            {"type": "object", "additionalProperties": false,
             "properties": {"attribute": {"type": "string", "enum": %s}, "value": {"type": "string"}},
             "required": ["attribute", "value"]}""".formatted(json(ATTRIBUTES));

    private static final String PARSE_SCHEMA = """
            {"type": "object", "additionalProperties": false,
             "properties": {
               "mustHave": {"type": "array", "items": %1$s},
               "niceToHave": {"type": "array", "items": %1$s},
               "category": {"type": ["string", "null"]},
               "keywords": {"type": "array", "items": {"type": "string"}},
               "maxBudgetChf": {"type": ["number", "null"]},
               "postcode": {"type": ["string", "null"]}},
             "required": ["mustHave", "niceToHave", "category", "keywords", "maxBudgetChf", "postcode"]}"""
            .formatted(REQUIREMENT_SCHEMA);

    private static final String PARSE_SYSTEM = """
            You turn a buyer's wish for a secondhand item on a Swiss marketplace into search requirements.
            - Requirement attributes ONLY from: %s. Must-have = clearly required; nice-to-have = wished but optional.
            - Never invent requirements the text does not state. Keep values short, as the buyer wrote them.
            - category ONLY one of: %s; null if unclear.
            - maxBudgetChf: the stated maximum price in CHF, else null.
            - postcode: for an obvious Swiss place a 4-digit postcode (Zürich 8001, Bern 3011, Luzern 6003,
              Zug 6300, Basel 4001, Lausanne 1003), else null.
            - keywords: 2-6 lowercase search terms incl. obvious synonyms
              (e.g. "laptop" -> "laptop", "notebook", "macbook" when Apple)."""
            .formatted(String.join(", ", ATTRIBUTES), String.join(", ", CATEGORIES));

    private static final String ITEM_SCHEMA = """
            {"type": "object", "additionalProperties": false,
             "properties": {"listingId": {"type": "integer"}, "reason": {"type": "string"},
               "missingDetails": {"type": "array", "items": {"type": "string"}},
               "differences": {"type": "array", "items": {"type": "string"}}},
             "required": ["listingId", "reason", "missingDetails", "differences"]}""";

    private static final String RANK_SCHEMA = """
            {"type": "object", "additionalProperties": false,
             "properties": {"confirmed": {"type": "array", "items": %1$s},
               "possible": {"type": "array", "items": %1$s},
               "alternatives": {"type": "array", "items": %1$s}},
             "required": ["confirmed", "possible", "alternatives"]}""".formatted(ITEM_SCHEMA);

    private static final String RANK_SYSTEM = """
            You sort secondhand listings for a buyer. Put each fitting listing in exactly one group:
            - confirmed: the listing states every must-have and fits budget and place.
            - possible: looks right, but a must-have is not stated; list what to ask the seller in missingDetails.
            - alternatives: a must-have or the budget clearly differs, but it is a reasonable substitute;
              say how in differences (e.g. "CHF 720 instead of at most CHF 600").
            Leave out listings that don't fit at all. reason: one short sentence for the buyer.
            Use only listing ids from the list.""";

    private final AiClient ai;
    private final EntityManager em;
    private final TransactionTemplate tx;
    private final String model;

    SearchService(AiClient ai, EntityManager em, TransactionTemplate tx, @Value("${ai.search-model}") String model) {
        this.ai = ai;
        this.em = em;
        this.tx = tx;
        this.model = model;
    }

    public SearchRequirements requirements(String text) {
        Parsed parsed;
        try {
            parsed = ai.ask(model, PARSE_SYSTEM, text, List.of(), PARSE_SCHEMA, Parsed.class);
        } catch (ResponseStatusException e) {
            if (e.getStatusCode() == HttpStatus.BAD_GATEWAY) {
                throw notUnderstood();
            }
            throw e;
        }
        if (parsed == null || parsed.mustHave() == null || parsed.niceToHave() == null) {
            throw notUnderstood();
        }
        String category = CATEGORIES.stream().filter(c -> c.equalsIgnoreCase(trim(parsed.category()))).findFirst()
                .orElse(null);
        List<String> keywords = parsed.keywords() == null ? List.of() : parsed.keywords().stream()
                .filter(Objects::nonNull).map(k -> k.trim().toLowerCase(Locale.ROOT)).filter(k -> !k.isEmpty())
                .distinct().limit(6).toList();
        String postcode = trim(parsed.postcode());
        return new SearchRequirements(canonical(parsed.mustHave()), canonical(parsed.niceToHave()), category,
                keywords, parsed.maxBudgetChf(), postcode != null && postcode.matches("\\d{4}") ? postcode : null,
                null, true);
    }

    public SearchResults matches(SearchRequirements req) {
        List<ListingDetail> candidates = candidates(req, true);
        if (candidates.size() < 5 && !req.keywords().isEmpty()) {
            candidates = candidates(req, false);
        }
        if (candidates.isEmpty()) {
            return new SearchResults(List.of(), List.of(), List.of());
        }
        Ranked ranked;
        try {
            ranked = ai.ask(model, RANK_SYSTEM, rankPrompt(req, candidates), List.of(), RANK_SCHEMA, Ranked.class);
        } catch (ResponseStatusException e) {
            log.warn("Search ranking without AI: {}", e.getReason());
            return new SearchResults(List.of(), candidates.stream().limit(MAX_PER_GROUP)
                    .map(l -> new SearchMatch(l.summary(), NO_AI_REASON, List.of(), List.of())).toList(), List.of());
        }
        return validate(req, candidates, ranked);
    }

    /** Drops unknown/duplicate ids, downgrades unproven "confirmed" items, applies acceptUnknown and the group size. */
    SearchResults validate(SearchRequirements req, List<ListingDetail> candidates, Ranked ranked) {
        Map<Long, ListingDetail> byId = candidates.stream()
                .collect(Collectors.toMap(ListingDetail::id, Function.identity()));
        Set<Long> seen = new HashSet<>();
        List<SearchMatch> confirmed = new ArrayList<>();
        List<SearchMatch> possible = new ArrayList<>();
        List<SearchMatch> alternatives = new ArrayList<>();
        for (Item item : orEmpty(ranked == null ? null : ranked.confirmed())) {
            ListingDetail listing = byId.get(item.listingId());
            if (listing == null || !seen.add(item.listingId())) continue;
            List<String> missing = req.mustHave().stream().filter(r -> !states(listing, r))
                    .map(r -> r.attribute() + ": " + r.value()).toList();
            if (missing.isEmpty()) {
                confirmed.add(match(listing, item, List.of()));
            } else {
                possible.add(match(listing, item, missing));
            }
        }
        for (Item item : orEmpty(ranked == null ? null : ranked.possible())) {
            ListingDetail listing = byId.get(item.listingId());
            if (listing != null && seen.add(item.listingId())) possible.add(match(listing, item, orEmpty(item.missingDetails())));
        }
        for (Item item : orEmpty(ranked == null ? null : ranked.alternatives())) {
            ListingDetail listing = byId.get(item.listingId());
            if (listing != null && seen.add(item.listingId())) alternatives.add(match(listing, item, List.of()));
        }
        return new SearchResults(limit(confirmed), req.acceptUnknown() ? limit(possible) : List.of(),
                limit(alternatives));
    }

    /** A must-have is stated when the listing has the attribute containing the value, or the title contains it. */
    static boolean states(ListingDetail listing, Requirement requirement) {
        // the condition is always stated on a listing (its own field), the AI judges whether it fits
        if (requirement.attribute().equalsIgnoreCase("Condition")) return true;
        String value = requirement.value().toLowerCase(Locale.ROOT);
        if (listing.title().toLowerCase(Locale.ROOT).contains(value)) return true;
        return listing.attributes().entrySet().stream().anyMatch(a -> a.getKey().equalsIgnoreCase(requirement.attribute())
                && a.getValue().toLowerCase(Locale.ROOT).contains(value));
    }

    List<ListingDetail> candidates(SearchRequirements req, boolean withKeywords) {
        StringBuilder jpql = new StringBuilder("select l from Listing l where 1 = 1");
        Map<String, Object> params = new HashMap<>();
        if (req.maxBudgetChf() != null) {
            jpql.append(" and l.priceChf <= :budget");
            params.put("budget", req.maxBudgetChf());
        }
        String postcode = trim(req.postcode());
        if (postcode != null && postcode.length() >= 2) {
            jpql.append(" and l.postcode like :region");
            params.put("region", postcode.substring(0, 2) + "%");
        }
        String category = trim(req.category());
        if (category != null) {
            jpql.append(" and lower(l.category) = :category");
            params.put("category", category.toLowerCase(Locale.ROOT));
        }
        List<String> keywords = req.keywords().stream().filter(Objects::nonNull).map(String::trim)
                .filter(k -> !k.isEmpty()).toList();
        if (withKeywords && !keywords.isEmpty()) {
            List<String> ors = new ArrayList<>();
            for (int i = 0; i < keywords.size(); i++) {
                ors.add("lower(l.title) like :k" + i + " or lower(l.description) like :k" + i);
                params.put("k" + i, "%" + keywords.get(i).toLowerCase(Locale.ROOT) + "%");
            }
            jpql.append(" and (").append(String.join(" or ", ors)).append(")");
        }
        jpql.append(" order by l.createdAt desc");
        return tx.execute(status -> {
            TypedQuery<Listing> query = em.createQuery(jpql.toString(), Listing.class).setMaxResults(MAX_CANDIDATES);
            params.forEach(query::setParameter);
            return query.getResultList().stream().map(Listing::detail).toList();
        });
    }

    private static String rankPrompt(SearchRequirements req, List<ListingDetail> candidates) {
        StringBuilder text = new StringBuilder("Buyer wants:\n");
        text.append("Must have: ").append(list(req.mustHave())).append('\n');
        text.append("Nice to have: ").append(list(req.niceToHave())).append('\n');
        if (req.category() != null) text.append("Category: ").append(req.category()).append('\n');
        if (req.maxBudgetChf() != null) text.append("Budget: at most CHF ").append(req.maxBudgetChf()).append('\n');
        if (req.postcode() != null) text.append("Near postcode: ").append(req.postcode()).append('\n');
        text.append("\nListings (id | title | price | category | place | condition | attributes):\n");
        for (ListingDetail l : candidates) {
            text.append(l.id()).append(" | ").append(l.title()).append(" | CHF ").append(l.priceChf())
                    .append(" | ").append(l.category()).append(" | ").append(l.postcode()).append(' ')
                    .append(l.locality()).append(" | ").append(l.condition()).append(" | ")
                    .append(l.attributes().entrySet().stream().map(a -> a.getKey() + "=" + a.getValue())
                            .collect(Collectors.joining("; ")))
                    .append('\n');
        }
        return text.toString();
    }

    private static List<Requirement> canonical(List<Requirement> requirements) {
        Map<String, Requirement> result = new LinkedHashMap<>();
        for (Requirement r : requirements) {
            if (r == null || trim(r.value()) == null) continue;
            ATTRIBUTES.stream().filter(a -> a.equalsIgnoreCase(trim(r.attribute()))).findFirst()
                    .ifPresent(a -> result.putIfAbsent(a, new Requirement(a, r.value().trim())));
        }
        return List.copyOf(result.values());
    }

    private static SearchMatch match(ListingDetail listing, Item item, List<String> missing) {
        return new SearchMatch(listing.summary(), item.reason(), missing, orEmpty(item.differences()));
    }

    private static String list(List<Requirement> requirements) {
        return requirements.isEmpty() ? "-" : requirements.stream().map(r -> r.attribute() + ": " + r.value())
                .collect(Collectors.joining(", "));
    }

    private static <T> List<T> orEmpty(List<T> list) {
        return list == null ? List.of() : list;
    }

    private static List<SearchMatch> limit(List<SearchMatch> matches) {
        return matches.stream().limit(MAX_PER_GROUP).toList();
    }

    private static String trim(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private static String json(List<String> values) {
        return values.stream().map(v -> "\"" + v + "\"").collect(Collectors.joining(", ", "[", "]"));
    }

    private static ResponseStatusException notUnderstood() {
        return new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Could not understand the search, please rephrase.");
    }
}
