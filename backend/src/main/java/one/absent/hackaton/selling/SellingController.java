package one.absent.hackaton.selling;

import java.net.URI;
import java.time.Instant;
import java.util.HashMap;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import one.absent.hackaton.listing.Listing;
import one.absent.hackaton.listing.ListingDetail;
import one.absent.hackaton.listing.ListingRepository;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@Tag(name = "Selling")
@RestController
@RequestMapping("/api/listings")
public class SellingController {
    private final ListingRepository listings;

    public SellingController(ListingRepository listings) {
        this.listings = listings;
    }

    @PostMapping
    @Transactional
    public ResponseEntity<ListingDetail> publish(@Valid @RequestBody CreateListingRequest request,
            @AuthenticationPrincipal Jwt seller) {
        // HAC-20 owns photo storage/linking. Never silently discard an uploaded photo.
        if (!request.photoIds().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Photo publishing is not available yet.");
        }
        var listing = new Listing();
        listing.setTitle(request.title());
        listing.setDescription(request.description());
        listing.setCategory(request.category());
        listing.setCondition(request.condition());
        listing.setPriceChf(request.priceChf());
        listing.setPostcode(request.postcode());
        listing.setLocality(request.locality());
        listing.setAttributes(new HashMap<>(request.attributes()));
        listing.setCreatedAt(Instant.now());
        listing.setSellerId(seller.getSubject());
        listing.setSellerName(seller.getClaimAsString("name"));
        listings.saveAndFlush(listing);
        return ResponseEntity.created(URI.create("/api/listings/" + listing.getId())).body(listing.detail());
    }
}
