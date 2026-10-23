package one.absent.hackaton.listing;

import java.math.BigDecimal;
import java.util.List;

import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.transaction.annotation.Transactional;

/** Public: browse and inspect listings. */
@Tag(name = "Listings")
@RestController
@RequestMapping("/api/listings")
@Transactional(readOnly = true)
public class ListingController {

    private final ListingRepository listings;

    public ListingController(ListingRepository listings) {
        this.listings = listings;
    }

    @GetMapping
    public List<ListingSummary> list(@RequestParam(required = false) String q,
                                     @RequestParam(required = false) String category,
                                     @RequestParam(required = false) BigDecimal maxPrice,
                                     @RequestParam(required = false) String postcode) {
        // Filtering remains the separate listings-backend task (HAC-17).
        return listings.findAll().stream().map(listing -> listing.detail().summary()).toList();
    }

    @GetMapping("/{id}")
    public ListingDetail get(@PathVariable long id) {
        return listings.findById(id).map(Listing::detail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Listing not found."));
    }
}
