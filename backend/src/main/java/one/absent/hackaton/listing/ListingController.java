package one.absent.hackaton.listing;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Public: browse and inspect listings. */
@Tag(name = "Listings")
@RestController
@RequestMapping("/api/listings")
public class ListingController {

    // shortcut: sample data, replaced by the listings backend issue (HAC-17)
    private static final List<ListingDetail> SAMPLES = List.of(
            new ListingDetail(1, "iMac 27\" Retina 5K (2017)", new BigDecimal("450.00"), Condition.GOOD, "Computers",
                    "8004", "Zürich", null,
                    "Works well, small scratch on the stand. Keyboard and mouse included.",
                    Map.of("Brand", "Apple", "Model", "iMac 18,3", "Display", "27\" 5K", "Year", "2017"),
                    Instant.parse("2026-10-20T09:15:00Z")),
            new ListingDetail(2, "Dell UltraSharp U2719D monitor", new BigDecimal("120.00"), Condition.LIKE_NEW,
                    "Monitors", "3011", "Bern", null,
                    "From an office clearance, barely used. DisplayPort cable included.",
                    Map.of("Brand", "Dell", "Model", "U2719D", "Size", "27\"", "Resolution", "2560x1440"),
                    Instant.parse("2026-10-21T14:30:00Z")),
            new ListingDetail(3, "Herman Miller Aeron office chair", new BigDecimal("380.00"), Condition.USED,
                    "Office furniture", "6343", "Rotkreuz", null,
                    "Size B, fully adjustable. Some wear on the armrests, pickup only.",
                    Map.of("Brand", "Herman Miller", "Model", "Aeron", "Size", "B"),
                    Instant.parse("2026-10-22T18:00:00Z")));

    @GetMapping
    public List<ListingSummary> list(@RequestParam(required = false) String q,
                                     @RequestParam(required = false) String category,
                                     @RequestParam(required = false) BigDecimal maxPrice,
                                     @RequestParam(required = false) String postcode) {
        return SAMPLES.stream().map(ListingDetail::summary).toList();
    }

    @GetMapping("/{id}")
    public ListingDetail get(@PathVariable long id) {
        return SAMPLES.stream()
                .filter(listing -> listing.id() == id)
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Listing not found."));
    }
}
