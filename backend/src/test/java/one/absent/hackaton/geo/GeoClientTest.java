package one.absent.hackaton.geo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.ExpectedCount.once;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.json.JsonMapper;

class GeoClientTest {

    static final String URL = "https://geo.test/rest/services/api/SearchServer"
            + "?searchText=8004&type=locations&origins=zipcode&sr=4326&limit=1";

    final RestClient.Builder builder = RestClient.builder();
    final MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    final GeoClient client = new GeoClient(builder, JsonMapper.builder().build(), "https://geo.test");

    @Test
    void readsTheCentroidAndCachesIt() {
        server.expect(once(), requestTo(URL)).andRespond(withSuccess(
                "{\"results\":[{\"attrs\":{\"lat\":47.378,\"lon\":8.5233,\"label\":\"<b>8004 - Zürich</b>\"}}]}",
                MediaType.APPLICATION_JSON));

        assertThat(client.locate("8004")).contains(new Coordinates(47.378, 8.5233));
        assertThat(client.locality("8004")).contains("Zürich"); // second call: no request, the mock allows only one
        server.verify();
    }

    @Test
    void unknownPostcodeAndErrorsGiveNoCoordinates() {
        server.expect(requestTo(URL)).andRespond(withSuccess("{\"results\":[]}", MediaType.APPLICATION_JSON));
        assertThat(client.locate("8004")).isEmpty();

        assertThat(client.locate("abc")).isEmpty(); // not a postcode: no request at all

        GeoClient failing = new GeoClient(builder, JsonMapper.builder().build(), "https://geo.test");
        server.reset();
        server.expect(requestTo(URL.replace("8004", "3011"))).andRespond(withServerError());
        assertThat(failing.locate("3011")).isEmpty();
    }

    @Test
    void findsThePostcodeAtCoordinates() {
        server.expect(requestTo("https://geo.test/rest/services/api/MapServer/identify?geometry=7.152,46.802"
                        + "&geometryType=esriGeometryPoint&layers=all:ch.swisstopo-vd.ortschaftenverzeichnis_plz"
                        + "&sr=4326&tolerance=0&returnGeometry=false"))
                .andRespond(withSuccess("{\"results\":[{\"attributes\":{\"plz\":1700,\"langtext\":\"Fribourg\"}}]}",
                        MediaType.APPLICATION_JSON));

        assertThat(client.placeAt(46.802, 7.152)).contains(new GeoClient.Place("1700", "Fribourg"));
        server.verify();
    }

    @Test
    void outsideSwitzerlandThereIsNoPostcode() {
        assertThat(client.placeAt(48.85, 2.35)).isEmpty(); // Paris: no request at all
    }

    @Test
    void distanceZurichToZugIsAboutTwentyEightKm() {
        assertThat(new Coordinates(47.378, 8.5234).distanceKm(new Coordinates(47.167, 8.505)))
                .isBetween(22.0, 25.0);
    }
}
