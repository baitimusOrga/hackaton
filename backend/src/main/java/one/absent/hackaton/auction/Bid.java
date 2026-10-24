package one.absent.hackaton.auction;

import java.math.BigDecimal;
import java.time.Instant;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A private maximum on an auction; never returned to anybody but its bidder. */
@Entity
@Getter
@Setter
@NoArgsConstructor
public class Bid {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false)
    private Long listingId;
    @Column(nullable = false)
    private String bidderId;
    @Column(nullable = false, length = 120)
    private String bidderName;
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal maxChf;
    @Column(nullable = false)
    private Instant createdAt;

    public Bid(Long listingId, String bidderId, String bidderName, BigDecimal maxChf, Instant createdAt) {
        this.listingId = listingId;
        this.bidderId = bidderId;
        this.bidderName = bidderName;
        this.maxChf = maxChf;
        this.createdAt = createdAt;
    }
}
