package one.absent.hackaton.geo;

import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@Tag(name = "Places")
@RestController
public class PlaceController {

    public record Place(String postcode, String locality) {}

    private final GeoClient geo;

    public PlaceController(GeoClient geo) {
        this.geo = geo;
    }

    @GetMapping("/api/places/{postcode}")
    public Place place(@PathVariable String postcode) {
        return geo.locality(postcode).map(locality -> new Place(postcode, locality))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Unknown postcode."));
    }
}
