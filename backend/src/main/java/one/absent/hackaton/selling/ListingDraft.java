package one.absent.hackaton.selling;

import java.math.BigDecimal;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import one.absent.hackaton.listing.Condition;

public record ListingDraft(List<Long> photoIds, String category, String title, String description,
                           @Schema(nullable = true) Condition condition, List<DraftFact> facts,
                           List<String> questions, PriceEstimate price,
                           List<PrivacyWarning> privacyWarnings) {

    public record DraftFact(String name, String value, FactSource source,
                            @Schema(nullable = true) String sourceUrl) {}

    /** {@code photo} is 1-based, in the order of {@code photoIds}. */
    public record PrivacyWarning(int photo, String text) {}

    public enum FactSource { LABEL, SELLER, SUGGESTION, WEB }

    public record PriceEstimate(@Schema(nullable = true) BigDecimal lowChf,
                                @Schema(nullable = true) BigDecimal midChf,
                                @Schema(nullable = true) BigDecimal highChf,
                                PriceConfidence confidence, boolean provisional,
                                List<PriceEvidence> evidence, String explanation,
                                @Schema(description = "Condition the range is adjusted to") Condition condition,
                                int comparableCount, int soldCount) {}

    public enum PriceConfidence { LOW, MEDIUM, HIGH }

    public enum Similarity { SAME_MODEL, SAME_BRAND, SIMILAR_TITLE }

    public record PriceEvidence(long listingId, String title, BigDecimal priceChf, Similarity similarity,
                                int similarityPercent, Condition condition, boolean sold, long ageDays,
                                BigDecimal adjustedPriceChf) {}
}
