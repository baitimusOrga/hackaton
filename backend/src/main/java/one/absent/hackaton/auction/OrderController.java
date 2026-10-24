package one.absent.hackaton.auction;

import java.time.Instant;

import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import one.absent.hackaton.listing.Listing;
import one.absent.hackaton.listing.ListingRepository;
import one.absent.hackaton.listing.ListingStatus;
import one.absent.hackaton.listing.ListingSummary;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** The order of a sold listing, seen by its seller and buyer; the seller marks it as shipped. */
@Tag(name = "Orders")
@RestController
@RequestMapping("/api/orders/{id}")
@Transactional
public class OrderController {

    public record Order(ListingSummary listing, boolean seller, @Schema(nullable = true) Instant shippedAt) {}

    private final ListingRepository listings;
    private final AuctionService auctions;

    public OrderController(ListingRepository listings, AuctionService auctions) {
        this.listings = listings;
        this.auctions = auctions;
    }

    @GetMapping
    public Order getOrder(@PathVariable long id, @AuthenticationPrincipal Jwt user) {
        return order(find(id, user), user);
    }

    @PostMapping("/ship")
    public Order ship(@PathVariable long id, @AuthenticationPrincipal Jwt user) {
        Listing listing = find(id, user);
        if (!order(listing, user).seller()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the seller can ship this order.");
        }
        if (listing.getShippedAt() != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This order has already been shipped.");
        }
        listing.setShippedAt(Instant.now());
        return order(listing, user);
    }

    /** Unknown, unsold and foreign orders are all 404, so ids of other people's deals stay hidden. */
    private Listing find(long id, Jwt user) {
        return listings.findForUpdate(id)
                .filter(l -> l.getStatus() == ListingStatus.SOLD)
                .filter(l -> user.getSubject().equals(l.getSellerId())
                        || user.getSubject().equals(auctions.buyerOf(l)))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found."));
    }

    private Order order(Listing listing, Jwt user) {
        return new Order(listing.detail().summary(), user.getSubject().equals(listing.getSellerId()),
                listing.getShippedAt());
    }
}
