package one.absent.hackaton.listing;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasItems;
import static org.hamcrest.Matchers.lessThanOrEqualTo;
import static org.hamcrest.Matchers.startsWith;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.List;
import java.util.Optional;

import com.jayway.jsonpath.JsonPath;

import one.absent.hackaton.geo.Coordinates;
import one.absent.hackaton.geo.GeoClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@ActiveProfiles("test")
class ListingControllerTest {

    @Autowired
    WebApplicationContext context;

    MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).build();
    }

    @Autowired
    ListingRepository listings;

    @MockitoBean
    GeoClient geo;

    @Test
    void qMatchesTitleOrDescriptionCaseInsensitiveNewestFirst() throws Exception {
        String body = mvc.perform(get("/api/listings").param("q", "IMAC"))
                .andExpect(status().isOk())
                // case-insensitive: "IMAC 27 ZOLL" (2301), "imac 27 2019" (2422), "iMac Netzteil" (2423)
                .andExpect(jsonPath("$[*].id").value(hasItems(2301, 2422, 2423)))
                .andExpect(jsonPath("$[0].description").doesNotExist())
                .andReturn().getResponse().getContentAsString();
        List<Integer> ids = JsonPath.read(body, "$[*].id");
        // newest first: 2422 (11 Oct 11:37) before 2421 (11:00) before 2301 (3 Oct)
        assertThat(ids.indexOf(2422)).isLessThan(ids.indexOf(2421));
        assertThat(ids.indexOf(2421)).isLessThan(ids.indexOf(2301));
    }

    @Test
    void categoryIsExactButCaseInsensitive() throws Exception {
        mvc.perform(get("/api/listings").param("category", "monitors"))
                .andExpect(jsonPath("$[*].category").value(everyItem(org.hamcrest.Matchers.is("Monitors"))))
                .andExpect(jsonPath("$[*].id").value(hasItems(2341, 2342, 2343)));
    }

    @Test
    void saleModeFiltersAndAuctionsEndSoonestFirst() throws Exception {
        mvc.perform(get("/api/listings").param("saleMode", "AUCTION"))
                .andExpect(jsonPath("$[*].id").value(contains(1301, 1302, 1303, 1304)));
        mvc.perform(get("/api/listings").param("saleMode", "FIXED"))
                .andExpect(jsonPath("$[*].id").value(not(hasItem(1301))));
    }

    @Test
    void endsBeforeKeepsOnlyAuctionsEndingEarlier() throws Exception {
        mvc.perform(get("/api/listings").param("endsBefore", java.time.Instant.now().plusSeconds(12 * 3600).toString()))
                .andExpect(jsonPath("$[*].id").value(contains(1301)));
    }

    @Test
    void maxPriceIsInclusive() throws Exception {
        mvc.perform(get("/api/listings").param("maxPrice", "70"))
                .andExpect(jsonPath("$[*].priceChf").value(everyItem(lessThanOrEqualTo(70.0))))
                // 2307 costs exactly 70
                .andExpect(jsonPath("$[*].id").value(hasItems(2303, 2307)));
    }

    @Test
    void postcodeIsAPrefix() throws Exception {
        mvc.perform(get("/api/listings").param("postcode", "301"))
                .andExpect(jsonPath("$[*].postcode").value(everyItem(startsWith("301"))))
                .andExpect(jsonPath("$[*].id").value(hasItems(2302, 2316, 2321)));
    }

    @Test
    void soldListingsAreHidden() throws Exception {
        Listing phone = listings.findById(2361L).orElseThrow();
        phone.setStatus(ListingStatus.SOLD);
        listings.save(phone);
        try {
            mvc.perform(get("/api/listings").param("q", "galaxy"))
                    .andExpect(jsonPath("$[*].id").value(not(hasItem(2361))));
        } finally {
            phone.setStatus(ListingStatus.AVAILABLE);
            listings.save(phone);
        }
    }

    @Test
    void detail() throws Exception {
        mvc.perform(get("/api/listings/2361"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Samsung Galaxy S23 128GB"))
                .andExpect(jsonPath("$.attributes.Model").value("Galaxy S23"))
                .andExpect(jsonPath("$.createdAt").value("2026-10-07T16:00:00Z"));
    }

    @Test
    void unknownIdIs404ProblemDetails() throws Exception {
        mvc.perform(get("/api/listings/999"))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.detail").value("Listing not found."));
    }

    @Test
    void radiusKeepsListingsNearThePostcodeNearestFirst() throws Exception {
        when(geo.locate("8004")).thenReturn(Optional.of(new Coordinates(47.378, 8.5234)));
        mvc.perform(get("/api/listings").param("postcode", "8004").param("radiusKm", "30"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].locality").value(hasItem("Zug")))
                .andExpect(jsonPath("$[*].locality").value(not(hasItem("Lausanne"))))
                .andExpect(jsonPath("$[0].locality").value("Zürich"))
                .andExpect(jsonPath("$[0].latitude").isNumber());
    }

    @Test
    void radiusWithAnUnknownPostcodeIsABadRequest() throws Exception {
        when(geo.locate("9999")).thenReturn(Optional.empty());
        mvc.perform(get("/api/listings").param("postcode", "9999").param("radiusKm", "10"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Postcode 9999 not found."));
    }

    @Test
    void radiusAroundThePositionNeedsNoPostcode() throws Exception {
        mvc.perform(get("/api/listings").param("lat", "47.378").param("lon", "8.5234").param("radiusKm", "30"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].locality").value(hasItem("Zug")))
                .andExpect(jsonPath("$[*].locality").value(not(hasItem("Lausanne"))))
                .andExpect(jsonPath("$[0].locality").value("Zürich"));
    }
}
