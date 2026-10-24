package one.absent.hackaton.listing;

import java.math.BigDecimal;
import java.time.Instant;

import io.swagger.v3.oas.annotations.media.Schema;

public record ListingSummary(long id, String title, BigDecimal priceChf, Condition condition, String category,
                             String postcode, String locality, String imageUrl,
                             @Schema(nullable = true) Double latitude,
                             @Schema(nullable = true) Double longitude,
                             SaleMode saleMode,
                             @Schema(nullable = true) Instant endsAt,
                             @Schema(nullable = true) BigDecimal currentBidChf,
                             int bidCount) {
}
