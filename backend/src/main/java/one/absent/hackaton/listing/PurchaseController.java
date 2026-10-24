package one.absent.hackaton.listing;

import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Buying a fixed-price listing: no payment yet, the listing is simply sold to the signed-in user. */
@Tag(name = "Purchases")
@RestController
@RequestMapping("/api/listings/{id}/purchase")
public class PurchaseController {
    private final ListingRepository listings;

    public PurchaseController(ListingRepository listings) {
        this.listings = listings;
    }

    @PostMapping
    @Transactional
    public ListingDetail buy(@PathVariable long id, @AuthenticationPrincipal Jwt buyer) {
        // the row lock makes sure two buyers cannot both get the listing
        Listing listing = listings.findForUpdate(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Listing not found."));
        if (listing.getSaleMode() != SaleMode.FIXED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Auctions are won by bidding, not bought.");
        }
        if (listing.getStatus() != ListingStatus.AVAILABLE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This listing has already been sold.");
        }
        if (buyer.getSubject().equals(listing.getSellerId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot buy your own listing.");
        }
        listing.setStatus(ListingStatus.SOLD);
        listing.setBuyerId(buyer.getSubject());
        return listing.detail();
    }
}
