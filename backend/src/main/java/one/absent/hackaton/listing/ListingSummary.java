package one.absent.hackaton.listing;

import java.math.BigDecimal;

public record ListingSummary(long id, String title, BigDecimal priceChf, Condition condition, String category,
                             String postcode, String locality, String imageUrl) {
}
