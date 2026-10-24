package one.absent.hackaton.geo;

import io.swagger.v3.oas.annotations.tags.Tag;
import one.absent.hackaton.geo.GeoClient.Place;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@Tag(name = "Places")
@RestController
public class PlaceController {

    private final GeoClient geo;

    public PlaceController(GeoClient geo) {
        this.geo = geo;
    }

    /** The seller's device position as postcode and locality, so nobody has to type them. */
    @GetMapping("/api/places/near")
    public Place near(@RequestParam double latitude, @RequestParam double longitude) {
        return geo.placeAt(latitude, longitude)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No Swiss postcode at this location."));
    }

    @GetMapping("/api/places/{postcode}")
    public Place place(@PathVariable String postcode) {
        return geo.locality(postcode).map(locality -> new Place(postcode, locality))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Unknown postcode."));
    }
}
