package one.absent.hackaton.clearance;

import java.math.BigDecimal;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import one.absent.hackaton.listing.Condition;

@Entity
@Getter
@Setter
@NoArgsConstructor
public class ClearanceItem {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false)
    private Long projectId;
    @Column(nullable = false, length = 120)
    private String name;
    @Column(nullable = false, length = 80)
    private String category;
    @Column(nullable = false)
    private int quantity;
    @Column(nullable = false)
    private boolean quantityConfirmed;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20)
    private Condition condition;
    @Column(length = 1000)
    private String notes;
    @Column(length = 80)
    private String brand;
    @Column(length = 80)
    private String model;
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal estimatedUnitChf;
    /** The price per piece the company set; null until it has looked at the estimate. */
    @Column(precision = 12, scale = 2)
    private BigDecimal unitPriceChf;
    private Long listingId;
}
