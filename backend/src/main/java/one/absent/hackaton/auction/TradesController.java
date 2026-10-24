package one.absent.hackaton.auction;

import java.util.List;
import java.util.stream.Stream;

import io.swagger.v3.oas.annotations.tags.Tag;
import one.absent.hackaton.listing.ListingRepository;
import one.absent.hackaton.listing.ListingStatus;
import one.absent.hackaton.listing.ListingSummary;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The signed-in user's finished deals. Bought = fixed-price purchases plus auctions won. */
@Tag(name = "Trades")
@RestController
@RequestMapping("/api/me/trades")
@Transactional(readOnly = true)
public class TradesController {

    public record Trades(List<ListingSummary> sold, List<ListingSummary> bought) {}

    private final ListingRepository listings;
    private final BidRepository bids;
    private final AuctionService auctions;

    public TradesController(ListingRepository listings, BidRepository bids, AuctionService auctions) {
        this.listings = listings;
        this.bids = bids;
        this.auctions = auctions;
    }

    @GetMapping
    public Trades trades(@AuthenticationPrincipal Jwt user) {
        String me = user.getSubject();
        List<ListingSummary> sold = listings.findBySellerIdAndStatusOrderByCreatedAtDesc(me, ListingStatus.SOLD)
                .stream().map(l -> l.detail().summary()).toList();
        List<ListingSummary> bought = Stream.concat(
                        listings.findByBuyerIdOrderByCreatedAtDesc(me).stream(),
                        bids.findSoldAuctionsBidOnBy(me).stream().filter(l -> me.equals(auctions.buyerOf(l))))
                .distinct() // auctions closed since V22 are found by both queries
                .map(l -> l.detail().summary()).toList();
        return new Trades(sold, bought);
    }
}
