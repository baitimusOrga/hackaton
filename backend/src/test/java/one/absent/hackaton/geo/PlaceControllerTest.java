package one.absent.hackaton.geo;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class PlaceControllerTest {
    final GeoClient geo = mock(GeoClient.class);
    final MockMvc mvc = MockMvcBuilders.standaloneSetup(new PlaceController(geo)).build();

    @Test void knownPostcodeGivesItsLocality() throws Exception {
        when(geo.locality("1700")).thenReturn(Optional.of("Fribourg"));

        mvc.perform(get("/api/places/1700"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.postcode").value("1700"))
                .andExpect(jsonPath("$.locality").value("Fribourg"));
    }

    @Test void coordinatesGiveTheirPostcode() throws Exception {
        when(geo.placeAt(46.802, 7.152)).thenReturn(Optional.of(new GeoClient.Place("1700", "Fribourg")));

        mvc.perform(get("/api/places/near").param("latitude", "46.802").param("longitude", "7.152"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.postcode").value("1700"))
                .andExpect(jsonPath("$.locality").value("Fribourg"));
    }

    @Test void coordinatesWithoutPostcodeAreNotFound() throws Exception {
        when(geo.placeAt(48.85, 2.35)).thenReturn(Optional.empty());

        mvc.perform(get("/api/places/near").param("latitude", "48.85").param("longitude", "2.35"))
                .andExpect(status().isNotFound());
    }

    @Test void unknownPostcodeIsNotFound() throws Exception {
        when(geo.locality("0000")).thenReturn(Optional.empty());

        mvc.perform(get("/api/places/0000")).andExpect(status().isNotFound());
    }
}
