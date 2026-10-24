package one.absent.hackaton.listing;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import io.swagger.v3.oas.annotations.media.Schema;

public record ListingDetail(long id, String title, BigDecimal priceChf, Condition condition, String category,
                            String postcode, String locality, String imageUrl, List<String> imageUrls, String description,
                            Map<String, String> attributes, Instant createdAt,
                            @Schema(nullable = true) String sellerName,
                            @Schema(nullable = true) Double latitude,
                            @Schema(nullable = true) Double longitude,
                            SaleMode saleMode,
                            @Schema(nullable = true) Instant endsAt,
                            @Schema(nullable = true) BigDecimal currentBidChf,
                            int bidCount) {

    public ListingSummary summary() {
        return new ListingSummary(id, title, priceChf, condition, category, postcode, locality, imageUrl, latitude,
                longitude, saleMode, endsAt, currentBidChf, bidCount);
    }
}
