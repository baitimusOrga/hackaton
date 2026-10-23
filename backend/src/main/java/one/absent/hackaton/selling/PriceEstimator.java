package one.absent.hackaton.selling;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import one.absent.hackaton.listing.Condition;
import one.absent.hackaton.listing.Listing;
import one.absent.hackaton.listing.ListingRepository;
import one.absent.hackaton.listing.ListingStatus;
import one.absent.hackaton.selling.ListingDraft.DraftFact;
import one.absent.hackaton.selling.ListingDraft.FactSource;
import one.absent.hackaton.selling.ListingDraft.PriceConfidence;
import one.absent.hackaton.selling.ListingDraft.PriceEstimate;
import one.absent.hackaton.selling.ListingDraft.PriceEvidence;
import one.absent.hackaton.selling.ListingDraft.Similarity;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Price range from comparable listings. Only the same brand and model is real evidence; look-alikes by title are
 * always provisional, and nothing similar means no numbers at all.
 */
@Component
@Transactional(readOnly = true) // reads lazy listing attributes outside the web request
public class PriceEstimator {
    // keep in sync with FACTORS in frontend components/price-panel.ts
    static final Map<Condition, BigDecimal> FACTORS = new EnumMap<>(Map.of(
            Condition.NEW, new BigDecimal("1.30"), Condition.LIKE_NEW, new BigDecimal("1.15"),
            Condition.GOOD, BigDecimal.ONE, Condition.USED, new BigDecimal("0.85"),
            Condition.DEFECTIVE, new BigDecimal("0.40")));
    private static final Map<Condition, String> LABELS = Map.of(
            Condition.NEW, "New", Condition.LIKE_NEW, "Like new", Condition.GOOD, "Good",
            Condition.USED, "Used", Condition.DEFECTIVE, "Defective");
    private static final int MAX_EVIDENCE = 8;

    private final ListingRepository listings;

    public PriceEstimator(ListingRepository listings) {
        this.listings = listings;
    }

    public PriceEstimate estimate(String category, String title) {
        return estimate(category, title, List.of(), null);
    }

    private record Match(Listing listing, Similarity similarity, int percent) {
        boolean sold() {
            return listing.getStatus() == ListingStatus.SOLD;
        }
    }

    // shortcut: filters every listing in memory, move to a query once there are thousands
    public PriceEstimate estimate(String category, String title, List<DraftFact> facts, Condition condition) {
        List<DraftFact> known = facts == null ? List.of() : facts;
        Optional<DraftFact> brandFact = fact(known, "Brand"), modelFact = fact(known, "Model");
        String brand = brandFact.map(DraftFact::value).orElse(null);
        String model = modelFact.map(DraftFact::value).orElse(null);
        boolean identified = brand != null && model != null;
        boolean suggested = Stream.of(brandFact, modelFact)
                .anyMatch(f -> f.filter(x -> x.source() == FactSource.SUGGESTION).isPresent());
        Condition target = condition == null ? Condition.GOOD : condition;

        Set<String> draftTokens = tokens(title);
        Set<String> modelTokens = model == null ? Set.of() : tokens(model);
        Set<String> draftWithModel = union(draftTokens, modelTokens);

        List<Match> matches = listings.findAll().stream()
                .filter(l -> l.getCategory().equalsIgnoreCase(category))
                .map(l -> match(l, brand, model, modelTokens, draftTokens, draftWithModel))
                .flatMap(Optional::stream)
                .toList();
        List<Match> sameModel = matches.stream().filter(m -> m.similarity() == Similarity.SAME_MODEL).toList();
        List<Match> used = sameModel.size() >= 3 ? sameModel : matches;
        List<Match> sold = used.stream().filter(Match::sold).toList();
        if (sold.size() >= 3) {
            used = sold;
        }

        if (used.isEmpty()) {
            String why = identified
                    ? "No estimate: no listing of this model in %s yet. Set your own price, we don't guess."
                            .formatted(category)
                    : "No estimate: we could not identify brand and model and found no listing similar enough. "
                            + "Photograph the type plate or set your own price.";
            return new PriceEstimate(null, null, null, PriceConfidence.LOW, true, List.of(), why, target, 0, 0);
        }

        List<BigDecimal> adjusted = used.stream().map(m -> adjust(m.listing(), target)).sorted().toList();
        BigDecimal low = percentile(adjusted, 0.25), mid = percentile(adjusted, 0.5),
                high = percentile(adjusted, 0.75);
        int modelCount = (int) used.stream().filter(m -> m.similarity() == Similarity.SAME_MODEL).count();

        PriceConfidence confidence = !identified ? PriceConfidence.LOW
                : modelCount >= 5 ? PriceConfidence.HIGH
                : modelCount >= 3 ? PriceConfidence.MEDIUM : PriceConfidence.LOW;
        boolean wide = used.size() >= 2 && high.compareTo(low.multiply(new BigDecimal("1.75"))) > 0;
        if (wide) {
            confidence = PriceConfidence.values()[Math.max(0, confidence.ordinal() - 1)];
        }
        if (suggested && confidence == PriceConfidence.HIGH) {
            confidence = PriceConfidence.MEDIUM;
        }

        int soldCount = (int) used.stream().filter(Match::sold).count();
        String explanation = explain(used.size(), soldCount, modelCount == used.size(), category, low, high, target,
                condition == null, identified, wide, confidence, modelCount, suggested);
        List<PriceEvidence> evidence = used.stream()
                .sorted(Comparator.comparingInt(Match::percent).reversed()
                        .thenComparing(m -> !m.sold())
                        .thenComparing(m -> m.listing().getCreatedAt(), Comparator.reverseOrder()))
                .limit(MAX_EVIDENCE)
                .map(m -> evidence(m, target)).toList();
        return new PriceEstimate(low, mid, high, confidence, confidence == PriceConfidence.LOW, evidence,
                explanation, target, used.size(), soldCount);
    }

    private static Optional<Match> match(Listing l, String brand, String model, Set<String> modelTokens,
                                         Set<String> draftTokens, Set<String> draftWithModel) {
        String compBrand = attribute(l, "Brand"), compModel = attribute(l, "Model");
        boolean brandsKnown = brand != null && compBrand != null;
        if (brandsKnown && !norm(brand).equals(norm(compBrand))) {
            return Optional.empty();
        }
        Set<String> compTokens = tokens(l.getTitle());
        double jaccard = jaccard(draftTokens, compTokens);
        if (!brandsKnown) {
            return jaccard >= 0.6 ? Optional.of(new Match(l, Similarity.SIMILAR_TITLE, percent(jaccard, 80)))
                    : Optional.empty();
        }
        Set<String> compModelTokens = compModel == null ? Set.of() : tokens(compModel);
        boolean sameModel = !modelTokens.isEmpty()
                && (union(compTokens, compModelTokens).containsAll(modelTokens)
                || (!compModelTokens.isEmpty() && draftWithModel.containsAll(compModelTokens)));
        if (sameModel) {
            return Optional.of(new Match(l, Similarity.SAME_MODEL, 100));
        }
        if (model != null && compModel != null) {
            return Optional.empty();
        }
        return jaccard >= 0.4 ? Optional.of(new Match(l, Similarity.SAME_BRAND, percent(jaccard, 90)))
                : Optional.empty();
    }

    private static int percent(double jaccard, int cap) {
        return Math.min(cap, (int) Math.round(100 * jaccard));
    }

    private static PriceEvidence evidence(Match m, Condition target) {
        Listing l = m.listing();
        return new PriceEvidence(l.getId(), l.getTitle(), l.getPriceChf(), m.similarity(), m.percent(),
                l.getCondition(), m.sold(), Duration.between(l.getCreatedAt(), Instant.now()).toDays(),
                adjust(l, target));
    }

    private static BigDecimal adjust(Listing l, Condition target) {
        return l.getPriceChf().divide(FACTORS.get(l.getCondition()), 10, RoundingMode.HALF_UP)
                .multiply(FACTORS.get(target)).setScale(2, RoundingMode.HALF_UP);
    }

    private static String explain(int count, int soldCount, boolean allSameModel, String category, BigDecimal low,
                                  BigDecimal high, Condition target, boolean assumed, boolean identified,
                                  boolean wide, PriceConfidence confidence, int modelCount, boolean suggested) {
        String basis = Stream.of(part(soldCount, "completed sales"), part(count - soldCount, "asking prices"))
                .filter(Objects::nonNull).collect(Collectors.joining(" and "));
        String text = ("Based on %s of %s in %s. Half of them land between CHF %s and CHF %s "
                + "once adjusted to condition %s%s.")
                .formatted(basis, allSameModel ? "the same model" : "similar items", category, low, high,
                        LABELS.get(target), assumed ? " (assumed)" : "");
        if (!identified) {
            return text + " Brand and model are not confirmed, so these are look-alikes only. "
                    + "Photograph the type plate for a reliable range.";
        }
        if (wide) {
            return text + " Prices vary widely, so treat this as a rough guide.";
        }
        if (confidence == PriceConfidence.LOW) {
            return text + " Only %d sales or listings of this exact model, so this estimate is provisional."
                    .formatted(modelCount);
        }
        if (suggested) {
            return text + " Brand or model is a suggestion from the photo; confirm it to firm this up.";
        }
        return text;
    }

    private static String part(int n, String what) {
        return n == 0 ? null : n + " " + what;
    }

    private static Optional<DraftFact> fact(List<DraftFact> facts, String name) {
        return facts.stream().filter(f -> f != null && name.equalsIgnoreCase(f.name())
                && f.value() != null && !f.value().isBlank()).findFirst();
    }

    private static String attribute(Listing l, String name) {
        String v = l.getAttributes().get(name);
        return v == null || v.isBlank() ? null : v;
    }

    private static Set<String> tokens(String s) {
        return Arrays.stream(s.toLowerCase(Locale.ROOT).split("[^\\p{L}\\p{N}]+"))
                .filter(w -> w.length() >= 2).collect(Collectors.toSet());
    }

    private static Set<String> union(Set<String> a, Set<String> b) {
        Set<String> all = new HashSet<>(a);
        all.addAll(b);
        return all;
    }

    private static String norm(String s) {
        return s.toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}]", "");
    }

    private static double jaccard(Set<String> a, Set<String> b) {
        Set<String> both = new HashSet<>(a);
        both.retainAll(b);
        int union = union(a, b).size();
        return union == 0 ? 0 : (double) both.size() / union;
    }

    /** Linear interpolation between the neighbouring ranks, rounded to whole francs. */
    static BigDecimal percentile(List<BigDecimal> sorted, double p) {
        double rank = p * (sorted.size() - 1);
        int lower = (int) Math.floor(rank);
        BigDecimal a = sorted.get(lower), b = sorted.get((int) Math.ceil(rank));
        return a.add(b.subtract(a).multiply(BigDecimal.valueOf(rank - lower))).setScale(0, RoundingMode.HALF_UP);
    }
}
