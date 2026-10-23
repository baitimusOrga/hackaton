package one.absent.hackaton.clearance;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

import one.absent.hackaton.ai.AiClient;
import one.absent.hackaton.clearance.ClearanceDtos.*;
import one.absent.hackaton.listing.Condition;
import one.absent.hackaton.listing.Listing;
import one.absent.hackaton.listing.ListingRepository;
import one.absent.hackaton.listing.ListingStatus;
import one.absent.hackaton.selling.PriceEstimator;
import org.springframework.stereotype.Service;

/** Inventory extraction, price estimates and the three clearance routes. */
@Service
public class ClearanceService {
    // assumption: share of the estimated resale value a company sells itself within the deadline
    static final BigDecimal SELF_SELL_THROUGH = new BigDecimal("0.70");
    // assumption: share of the estimated resale value we sell when we run the sale
    static final BigDecimal MANAGED_SELL_THROUGH = new BigDecimal("0.85");
    // assumption: our service fee on the proceeds of managed selling, agreed upfront
    static final BigDecimal MANAGED_FEE = new BigDecimal("0.15");
    // assumption: fixed direct-purchase offer as a share of the estimated resale value
    static final BigDecimal DIRECT_OFFER = new BigDecimal("0.45");
    // assumption: below this many days only a direct purchase clears the site in time
    static final int URGENT_DAYS = 14;

    // assumption: unit price in CHF when no comparable listing exists
    private static final Map<String, Integer> FALLBACK_CHF = Map.of("Computers", 300, "Laptops", 300,
            "Monitors", 90, "Phones", 200, "Tablets", 200, "Office furniture", 150, "Office equipment", 80,
            "Audio", 80, "Cameras", 300, "Household", 40);
    private static final int OTHER_FALLBACK_CHF = 50;

    static final String SYSTEM = """
            You turn a company's office inventory (pasted text and/or photos) into line items for a Swiss
            secondhand marketplace. Rules:
            - One item per distinct product/model line; never merge different models; never split one line.
            - name: concise, brand and model first when given, at most 80 characters; never invent a brand or model.
            - quantity: the stated integer. If it is approximate ("ca.", "~", "about", "?") or counted from photos,
              give your best integer and start the notes with "Quantity approximate, please count."; 1 if none given.
            - condition: from the text or photos; if not stated use USED and add "Condition not stated." to the notes.
            - category: the best fit from the allowed list; printers, scanners, projectors and desk phone systems
              are Office equipment.
            - notes: at most 200 characters, factual (accessories, wear, data wiping as stated); no claims about
              function.
            - Ignore header rows, totals and lines that are not items. At most 50 items.
            """;

    static final String SCHEMA = """
            {"type": "object", "additionalProperties": false, "required": ["items"],
             "properties": {"items": {"type": "array", "items": {"type": "object", "additionalProperties": false,
               "required": ["name", "category", "quantity", "condition", "notes"],
               "properties": {
                 "name": {"type": "string"},
                 "category": {"type": "string", "enum": ["Computers", "Laptops", "Monitors", "Phones", "Tablets",
                   "Office furniture", "Office equipment", "Audio", "Cameras", "Household", "Other"]},
                 "quantity": {"type": "integer"},
                 "condition": {"type": "string", "enum": ["NEW", "LIKE_NEW", "GOOD", "USED", "DEFECTIVE"]},
                 "notes": {"type": "string"}}}}}}
            """;

    record AiInventory(List<AiItem> items) {}

    record AiItem(String name, String category, int quantity, Condition condition, String notes) {}

    private final AiClient ai;
    private final PriceEstimator priceEstimator;
    private final ListingRepository listings;
    private final ClearanceItemRepository items;

    public ClearanceService(AiClient ai, PriceEstimator priceEstimator, ListingRepository listings,
                            ClearanceItemRepository items) {
        this.ai = ai;
        this.priceEstimator = priceEstimator;
        this.listings = listings;
        this.items = items;
    }

    /** Adds the items the AI reads from {@code text} and {@code images}; all start with unconfirmed quantities. */
    void extract(ClearanceProject project, String text, List<AiClient.Image> images) {
        AiInventory inventory = ai.ask(SYSTEM, text.isBlank() ? "Inventory from photos." : text, images, SCHEMA,
                AiInventory.class);
        if (inventory == null || inventory.items() == null) {
            return;
        }
        for (AiItem read : inventory.items().stream().filter(i -> i.name() != null && !i.name().isBlank())
                .limit(50).toList()) {
            var item = new ClearanceItem();
            item.setProjectId(project.getId());
            item.setName(cut(read.name().strip(), 120));
            item.setCategory(cut(read.category() == null || read.category().isBlank() ? "Other" : read.category(), 80));
            item.setQuantity(Math.clamp(read.quantity(), 1, 10000));
            item.setCondition(read.condition() == null ? Condition.USED : read.condition());
            item.setNotes(blankToNull(read.notes()));
            item.setEstimatedUnitChf(estimateUnit(item.getCategory(), item.getName(), item.getCondition()));
            items.save(item);
        }
    }

    BigDecimal estimateUnit(String category, String name, Condition condition) {
        return unitPrice(priceEstimator.estimate(category, name).midChf(), category, condition);
    }

    /** Whole-franc price per piece: comparable median (or category fallback) times a condition factor. */
    static BigDecimal unitPrice(BigDecimal mid, String category, Condition condition) {
        BigDecimal base = mid != null ? mid
                : BigDecimal.valueOf(FALLBACK_CHF.getOrDefault(category, OTHER_FALLBACK_CHF));
        BigDecimal factor = switch (condition) {
            case USED -> new BigDecimal("0.8");
            case DEFECTIVE -> new BigDecimal("0.2");
            default -> BigDecimal.ONE;
        };
        return base.multiply(factor).setScale(0, RoundingMode.HALF_UP).max(BigDecimal.ONE);
    }

    static List<RouteOption> routes(BigDecimal resale, int itemLines) {
        BigDecimal proceeds = chf(resale.multiply(MANAGED_SELL_THROUGH));
        BigDecimal fee = chf(proceeds.multiply(MANAGED_FEE));
        return List.of(
                new RouteOption(Route.SELF_SERVICE, chf(resale.multiply(SELF_SELL_THROUGH)), chf(BigDecimal.ZERO),
                        false, "6–8 weeks", "You list, answer buyers and hand over " + itemLines + " item lines"),
                new RouteOption(Route.MANAGED, proceeds.subtract(fee), fee, false, "3–4 weeks",
                        "Give us site access once"),
                new RouteOption(Route.DIRECT_PURCHASE, chf(resale.multiply(DIRECT_OFFER)), chf(BigDecimal.ZERO),
                        true, "Paid within 5 working days", "Nothing — we collect everything"));
    }

    static Route recommend(long daysLeft, List<RouteOption> options) {
        return daysLeft < URGENT_DAYS ? Route.DIRECT_PURCHASE
                : options.stream().max(Comparator.comparing(RouteOption::netChf)).orElseThrow().route();
    }

    static String reason(Route recommended) {
        return recommended == Route.DIRECT_PURCHASE ? "Only route that clears the site before the deadline."
                : "Highest expected net outcome without your team's time.";
    }

    ProjectDetail detail(ClearanceProject project) {
        List<ClearanceItem> rows = items.findByProjectIdOrderById(project.getId());
        Map<Long, ListingStatus> listingStatus = listings
                .findAllById(rows.stream().map(ClearanceItem::getListingId).filter(Objects::nonNull).toList())
                .stream().collect(Collectors.toMap(Listing::getId, Listing::getStatus));
        List<ItemView> views = rows.stream().map(i -> new ItemView(i.getId(), i.getName(), i.getCategory(),
                i.getQuantity(), i.isQuantityConfirmed(), i.getCondition(), i.getNotes(), i.getEstimatedUnitChf(),
                total(i), i.getListingId() == null ? ItemStatus.DRAFT
                        : listingStatus.get(i.getListingId()) == ListingStatus.SOLD ? ItemStatus.SOLD
                        : ItemStatus.LISTED, i.getListingId())).toList();
        BigDecimal resale = rows.stream().map(ClearanceService::total).reduce(BigDecimal.ZERO, BigDecimal::add);
        Totals totals = new Totals(rows.size(), rows.stream().mapToInt(ClearanceItem::getQuantity).sum(), resale,
                count(views, ItemStatus.DRAFT), count(views, ItemStatus.LISTED), count(views, ItemStatus.SOLD));
        long daysLeft = ChronoUnit.DAYS.between(LocalDate.now(ZoneId.of("Europe/Zurich")), project.getDeadline());
        List<RouteOption> options = routes(resale, rows.size());
        Route recommended = recommend(daysLeft, options);
        return new ProjectDetail(project.getId(), project.getCompanyName(), project.getPostcode(),
                project.getLocality(), project.getDeadline(), daysLeft, project.getRoute(), views, totals, options,
                recommended, reason(recommended));
    }

    private static BigDecimal total(ClearanceItem item) {
        return item.getEstimatedUnitChf().multiply(BigDecimal.valueOf(item.getQuantity()));
    }

    private static int count(List<ItemView> views, ItemStatus status) {
        return (int) views.stream().filter(v -> v.status() == status).count();
    }

    private static BigDecimal chf(BigDecimal amount) {
        return amount.setScale(0, RoundingMode.HALF_UP);
    }

    static String cut(String value, int max) {
        return value.length() <= max ? value : value.substring(0, max);
    }

    static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : cut(value.strip(), 1000);
    }
}
