package one.absent.hackaton.listing;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;

public record ListingDetail(long id, String title, BigDecimal priceChf, Condition condition, String category,
                            String postcode, String locality, String imageUrl, String description,
                            Map<String, String> attributes, Instant createdAt) {

    public ListingSummary summary() {
        return new ListingSummary(id, title, priceChf, condition, category, postcode, locality, imageUrl);
    }
}
