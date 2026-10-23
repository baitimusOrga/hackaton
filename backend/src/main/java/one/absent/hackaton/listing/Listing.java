package one.absent.hackaton.listing;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

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
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20)
    private ListingStatus status = ListingStatus.AVAILABLE;
    @ElementCollection
    @CollectionTable(name = "listing_attribute", joinColumns = @JoinColumn(name = "listing_id"))
    @MapKeyColumn(name = "name", length = 80)
    @Column(name = "attribute_value", nullable = false, length = 500)
    private Map<String, String> attributes = new HashMap<>();

    public ListingDetail detail() {
        return new ListingDetail(id, title, priceChf, condition, category, postcode, locality,
                imageUrl, description, Map.copyOf(attributes), createdAt, sellerName, latitude, longitude);
    }
}
