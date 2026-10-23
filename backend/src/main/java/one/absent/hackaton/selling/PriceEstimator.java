package one.absent.hackaton.selling;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import one.absent.hackaton.listing.Listing;
import one.absent.hackaton.listing.ListingRepository;
import one.absent.hackaton.selling.ListingDraft.PriceConfidence;
import one.absent.hackaton.selling.ListingDraft.PriceEstimate;
import one.absent.hackaton.selling.ListingDraft.PriceEvidence;
import org.springframework.stereotype.Component;

/** Price range from comparable listings: same category and at least one title word in common. */
@Component
public class PriceEstimator {
    private final ListingRepository listings;

    public PriceEstimator(ListingRepository listings) {
        this.listings = listings;
    }

    // shortcut: filters every listing in memory, move to a query once there are thousands
    public PriceEstimate estimate(String category, String title) {
        Set<String> words = words(title);
        List<Listing> comparables = listings.findAll().stream()
                .filter(l -> l.getCategory().equalsIgnoreCase(category))
                .filter(l -> words(l.getTitle()).stream().anyMatch(words::contains))
                .sorted(Comparator.comparing(Listing::getPriceChf))
                .toList();
        if (comparables.isEmpty()) {
            return new PriceEstimate(null, null, null, PriceConfidence.LOW, true, List.of(),
                    "No comparable listings yet, set your own price.");
        }
        List<BigDecimal> prices = comparables.stream().map(Listing::getPriceChf).toList();
        BigDecimal low = percentile(prices, 0.25), mid = percentile(prices, 0.5), high = percentile(prices, 0.75);
        int n = comparables.size();
        boolean provisional = n < 3;
        PriceConfidence confidence = provisional ? PriceConfidence.LOW
                : n < 10 ? PriceConfidence.MEDIUM : PriceConfidence.HIGH;
        String explanation = "%d comparable %s in %s ask between CHF %s and CHF %s, typically around CHF %s."
                .formatted(n, n == 1 ? "listing" : "listings", category, low, high, mid);
        if (provisional) {
            explanation += " With so few comparables this is a provisional estimate.";
        }
        List<PriceEvidence> evidence = comparables.stream().limit(5)
                .map(l -> new PriceEvidence(l.getId(), l.getTitle(), l.getPriceChf())).toList();
        return new PriceEstimate(low, mid, high, confidence, provisional, evidence, explanation);
    }

    private static Set<String> words(String title) {
        return Arrays.stream(title.toLowerCase().split("[^\\p{L}\\p{N}]+"))
                .filter(w -> w.length() >= 3)
                .collect(Collectors.toSet());
    }

    /** Linear interpolation between the neighbouring ranks, rounded to whole francs. */
    static BigDecimal percentile(List<BigDecimal> sorted, double p) {
        double rank = p * (sorted.size() - 1);
        int lower = (int) Math.floor(rank);
        BigDecimal a = sorted.get(lower), b = sorted.get((int) Math.ceil(rank));
        return a.add(b.subtract(a).multiply(BigDecimal.valueOf(rank - lower))).setScale(0, RoundingMode.HALF_UP);
    }
}
