package one.absent.hackaton.listing;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.media.Schema.RequiredMode;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** The signed-in user's own listings, whatever their status, and taking one back. */
@Tag(name = "MyListings")
@RestController
@RequestMapping("/api/me/listings")
@Transactional
public class MyListingsController {

    public record MyListing(@Schema(requiredMode = RequiredMode.REQUIRED) ListingSummary listing,
                            @Schema(requiredMode = RequiredMode.REQUIRED) ListingStatus status) {}

    private final ListingRepository listings;

    public MyListingsController(ListingRepository listings) {
        this.listings = listings;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<MyListing> listMine(@AuthenticationPrincipal Jwt user) {
        return listings.findBySellerIdOrderByCreatedAtDesc(user.getSubject()).stream()
                .map(l -> new MyListing(l.detail().summary(), l.getStatus())).toList();
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void withdraw(@PathVariable long id, @AuthenticationPrincipal Jwt user) {
        // the row lock keeps a bid or a purchase from landing while the seller withdraws
        Listing listing = listings.findForUpdate(id).filter(l -> user.getSubject().equals(l.getSellerId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Listing not found."));
        if (listing.getStatus() != ListingStatus.AVAILABLE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This listing is already sold or ended.");
        }
        if (listing.getSaleMode() != SaleMode.FIXED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Auctions cannot be withdrawn; they run to their end.");
        }
        listing.setStatus(ListingStatus.WITHDRAWN);
    }
}
