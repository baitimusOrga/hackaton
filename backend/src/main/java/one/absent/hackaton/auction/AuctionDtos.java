package one.absent.hackaton.auction;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;

/** Request and response bodies of the auction API. No body ever carries another bidder's maximum. */
public final class AuctionDtos {
    private AuctionDtos() {}

    public record PlaceBidRequest(
            @NotNull @DecimalMin(value = "0", inclusive = false) @Digits(integer = 10, fraction = 2) BigDecimal maxChf) {}

    /** One row of the visible price history; {@code amountChf} is the price after that bid, never a maximum. */
    public record BidView(BigDecimal amountChf, String bidder, Instant at, boolean automatic, boolean mine,
                          @Schema(nullable = true, description = "Your maximum behind this row; only on your own rows")
                          BigDecimal myMaxChf) {}

    public record AuctionState(Instant endsAt, boolean ended, @Schema(nullable = true) BigDecimal currentBidChf,
                               int bidCount, BigDecimal minimumNextBidChf, BigDecimal incrementChf,
                               @Schema(nullable = true) BigDecimal myMaxChf, boolean leading,
                               @Schema(description = "The viewer is the seller and cannot bid") boolean ownListing,
                               @Schema(description = "Newest first") List<BidView> bids) {}
}
