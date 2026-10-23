package one.absent.hackaton.geo;

import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Swiss postcode → centroid and locality through the swisstopo SearchServer (free, no key). */
@Slf4j
@Component
public class GeoClient {

    private final RestClient http;
    private final JsonMapper json;
    // shortcut: in-memory cache, lost on restart; move to a table if swisstopo's fair-use limit hits
    private final Map<String, Optional<Place>> cache = new ConcurrentHashMap<>();

    private record Place(Coordinates coordinates, String locality) {}

    @Autowired
    public GeoClient(JsonMapper json, @Value("${geo.base-url}") String baseUrl) {
        this(RestClient.builder().requestFactory(timeout()), json, baseUrl);
    }

    GeoClient(RestClient.Builder http, JsonMapper json, String baseUrl) {
        this.http = http.baseUrl(baseUrl).build();
        this.json = json;
    }

    /** Empty for an unknown postcode and on any error: callers must cope without coordinates. */
    public Optional<Coordinates> locate(String postcode) {
        return place(postcode).map(Place::coordinates);
    }

    /** The locality of a postcode, e.g. "Zürich" for 8004; empty when unknown or on any error. */
    public Optional<String> locality(String postcode) {
        return place(postcode).map(Place::locality);
    }

    private Optional<Place> place(String postcode) {
        if (postcode == null || !postcode.matches("\\d{4}")) {
            return Optional.empty();
        }
        Optional<Place> cached = cache.get(postcode);
        if (cached != null) {
            return cached;
        }
        try {
            String body = http.get().uri("/rest/services/api/SearchServer?searchText={p}&type=locations&origins=zipcode&sr=4326&limit=1",
                    postcode).retrieve().body(String.class);
            JsonNode attrs = json.readTree(body).path("results").path(0).path("attrs");
            // the label reads "<b>8004 - Zürich</b>"
            String label = attrs.path("label").asString().replaceAll("<[^>]+>", "");
            int dash = label.indexOf(" - ");
            Optional<Place> found = attrs.has("lat") && attrs.has("lon")
                    ? Optional.of(new Place(new Coordinates(attrs.get("lat").asDouble(), attrs.get("lon").asDouble()),
                            label.substring(dash < 0 ? 0 : dash + 3).strip()))
                    : Optional.empty();
            cache.put(postcode, found); // an unknown postcode is cached too
            return found;
        } catch (RestClientException | JacksonException e) {
            log.warn("No place for postcode {}: {}", postcode, e.getMessage());
            return Optional.empty();
        }
    }

    private static JdkClientHttpRequestFactory timeout() {
        var factory = new JdkClientHttpRequestFactory();
        factory.setReadTimeout(Duration.ofSeconds(5));
        return factory;
    }
}
