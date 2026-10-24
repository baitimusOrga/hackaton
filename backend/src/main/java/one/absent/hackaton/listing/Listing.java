package one.absent.hackaton.listing;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.BatchSize;

@Entity
@Getter
@Setter
@NoArgsConstructor
public class Listing {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, length = 120)
    private String title;
    @Column(nullable = false, length = 4000)
    private String description;
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal priceChf;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20)
    private Condition condition;
    @Column(nullable = false, length = 80)
    private String category;
    @Column(nullable = false, length = 4)
    private String postcode;
    @Column(nullable = false, length = 120)
    private String locality;
    // postcode centroid, null when the postcode could not be resolved
    private Double latitude;
    private Double longitude;
    @Column(length = 500)
    private String imageUrl;
    @Column(nullable = false)
    private Instant createdAt;
    private String sellerId;
    private String sellerName;
    // set when a fixed-price listing is bought; auction winners come from the bids
    private String buyerId;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20)
    private ListingStatus status = ListingStatus.AVAILABLE;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20)
    private SaleMode saleMode = SaleMode.FIXED;
    // auctions only: priceChf is the start price, the bid columns are denormalised from the bid table
    private Instant endsAt;
    @Column(precision = 12, scale = 2)
    private BigDecimal currentBidChf;
    @Column(nullable = false)
    private int bidCount;
    @ElementCollection
    @BatchSize(size = 60) // one select for all attributes of a result page instead of one per listing
    @CollectionTable(name = "listing_attribute", joinColumns = @JoinColumn(name = "listing_id"))
    @MapKeyColumn(name = "name", length = 80)
    @Column(name = "attribute_value", nullable = false, length = 500)
    private Map<String, String> attributes = new HashMap<>();

    public ListingDetail detail() {
        return detail(List.of());
    }

    /** {@code photoIds} in upload order; demo listings have none and show just {@code imageUrl}. */
    public ListingDetail detail(List<Long> photoIds) {
        List<String> imageUrls = photoIds.isEmpty() ? Stream.ofNullable(imageUrl).toList()
                : photoIds.stream().map(photoId -> "/api/photos/" + photoId).toList();
        return new ListingDetail(id, title, priceChf, condition, category, postcode, locality,
                imageUrl, imageUrls, description, Map.copyOf(attributes), createdAt, sellerName, latitude, longitude,
                saleMode, endsAt, currentBidChf, bidCount, status);
    }
}
