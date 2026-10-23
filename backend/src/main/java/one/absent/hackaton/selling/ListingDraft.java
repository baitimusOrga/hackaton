package one.absent.hackaton.selling;

import java.math.BigDecimal;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import one.absent.hackaton.listing.Condition;

public record ListingDraft(List<Long> photoIds, String category, String title, String description,
                           @Schema(nullable = true) Condition condition, List<DraftFact> facts,
                           List<String> questions, PriceEstimate price) {

    public record DraftFact(String name, String value, FactSource source) {}

    public enum FactSource { LABEL, SELLER, SUGGESTION }

    public record PriceEstimate(@Schema(nullable = true) BigDecimal lowChf,
                                @Schema(nullable = true) BigDecimal midChf,
                                @Schema(nullable = true) BigDecimal highChf,
                                PriceConfidence confidence, boolean provisional,
                                List<PriceEvidence> evidence, String explanation) {}

    public enum PriceConfidence { LOW, MEDIUM, HIGH }

    public record PriceEvidence(long listingId, String title, BigDecimal priceChf) {}
}
