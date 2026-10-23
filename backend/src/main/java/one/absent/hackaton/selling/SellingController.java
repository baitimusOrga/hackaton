package one.absent.hackaton.selling;

import java.net.URI;
import java.time.Instant;
import java.util.HashMap;
import java.util.HashSet;

import io.swagger.v3.oas.annotations.tags.Tag;
import one.absent.hackaton.geo.GeoClient;
import one.absent.hackaton.listing.Attributes;
import one.absent.hackaton.listing.Categories;
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
    private final PhotoRepository photoRepository;

    private final GeoClient geo;

    public SellingController(ListingRepository listings, PhotoRepository photoRepository, GeoClient geo) {
        this.listings = listings;
        this.photoRepository = photoRepository;
        this.geo = geo;
    }

    @PostMapping
    @Transactional
    public ResponseEntity<ListingDetail> publish(@Valid @RequestBody CreateListingRequest request,
            @AuthenticationPrincipal Jwt seller) {
        if (!Categories.ALL.contains(request.category())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown category: " + request.category());
        }
        if (!Attributes.ALL.containsAll(request.attributes().keySet())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown detail name. Allowed: "
                    + String.join(", ", Attributes.ALL));
        }
        var photos = photoRepository.findAllById(request.photoIds());
        if (photos.size() != new HashSet<>(request.photoIds()).size() || photos.stream().anyMatch(
                p -> p.getListingId() != null || !p.getSellerId().equals(seller.getSubject()))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Some photos are unknown or already used. Please add them again.");
        }
        var listing = new Listing();
        if (!request.photoIds().isEmpty()) {
            listing.setImageUrl("/api/photos/" + request.photoIds().getFirst());
        }
        listing.setTitle(request.title());
        listing.setDescription(request.description());
        listing.setCategory(request.category());
        listing.setCondition(request.condition());
        listing.setPriceChf(request.priceChf());
        listing.setPostcode(request.postcode());
        listing.setLocality(request.locality());
        geo.locate(request.postcode()).ifPresent(c -> {
            listing.setLatitude(c.latitude());
            listing.setLongitude(c.longitude());
        });
        listing.setAttributes(new HashMap<>(request.attributes()));
        listing.setCreatedAt(Instant.now());
        listing.setSellerId(seller.getSubject());
        listing.setSellerName(seller.getClaimAsString("name"));
        listings.saveAndFlush(listing);
        photos.forEach(p -> p.setListingId(listing.getId()));
        return ResponseEntity.created(URI.create("/api/listings/" + listing.getId())).body(listing.detail());
    }
}
