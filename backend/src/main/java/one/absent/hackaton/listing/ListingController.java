package one.absent.hackaton.listing;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

import io.swagger.v3.oas.annotations.tags.Tag;
import one.absent.hackaton.geo.Coordinates;
import one.absent.hackaton.geo.GeoClient;
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
    private final GeoClient geo;

    public ListingController(ListingRepository listings, GeoClient geo) {
        this.listings = listings;
        this.geo = geo;
    }

    @GetMapping
    public List<ListingSummary> list(@RequestParam(required = false) String q,
                                     @RequestParam(required = false) String category,
                                     @RequestParam(required = false) BigDecimal maxPrice,
                                     @RequestParam(required = false) String postcode,
                                     @RequestParam(required = false) Double radiusKm,
                                     @RequestParam(required = false) Double lat,
                                     @RequestParam(required = false) Double lon) {
        String code = postcode == null || postcode.isBlank() ? null : postcode.strip();
        boolean here = lat != null && lon != null; // the buyer's position wins over the postcode
        if (radiusKm == null || (code == null && !here)) {
            return listings.search(contains(q), lower(category), maxPrice, code == null ? null : code + "%",
                    null, null, null, null).stream().map(listing -> listing.detail().summary()).toList();
        }
        if (radiusKm <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The radius must be more than 0 km.");
        }
        Coordinates origin = here ? new Coordinates(lat, lon) : geo.locate(code).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Postcode " + code + " not found."));
        double latSpan = Coordinates.latitudeSpan(radiusKm);
        double lonSpan = origin.longitudeSpan(radiusKm);
        return listings.search(contains(q), lower(category), maxPrice, null,
                        origin.latitude() - latSpan, origin.latitude() + latSpan,
                        origin.longitude() - lonSpan, origin.longitude() + lonSpan)
                .stream().map(Listing::detail)
                .filter(l -> origin.distanceKm(new Coordinates(l.latitude(), l.longitude())) <= radiusKm)
                .sorted(Comparator.comparingDouble(
                        l -> origin.distanceKm(new Coordinates(l.latitude(), l.longitude()))))
                .map(ListingDetail::summary).toList();
    }

    private static String lower(String value) {
        return value == null || value.isBlank() ? null : value.strip().toLowerCase(Locale.ROOT);
    }

    // shortcut: % and _ typed by the user act as wildcards, fine for a search box
    private static String contains(String value) {
        String lower = lower(value);
        return lower == null ? null : "%" + lower + "%";
    }

    @GetMapping("/{id}")
    public ListingDetail get(@PathVariable long id) {
        return listings.findById(id).map(Listing::detail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Listing not found."));
    }
}
