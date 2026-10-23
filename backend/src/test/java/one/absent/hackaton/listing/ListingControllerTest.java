package one.absent.hackaton.listing;

import static org.hamcrest.Matchers.contains;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
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

    @Test
    void qMatchesTitleOrDescriptionCaseInsensitiveNewestFirst() throws Exception {
        mvc.perform(get("/api/listings").param("q", "IMAC"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].id").value(contains(1, 1002, 1001)))
                .andExpect(jsonPath("$[0].priceChf").value(450.00))
                .andExpect(jsonPath("$[0].condition").value("GOOD"))
                .andExpect(jsonPath("$[0].description").doesNotExist());
    }

    @Test
    void categoryIsExactButCaseInsensitive() throws Exception {
        mvc.perform(get("/api/listings").param("category", "monitors"))
                .andExpect(jsonPath("$[*].id").value(contains(2, 1006, 1005)));
    }

    @Test
    void maxPriceIsInclusive() throws Exception {
        mvc.perform(get("/api/listings").param("maxPrice", "70"))
                .andExpect(jsonPath("$[*].id").value(contains(1017, 1006)));
    }

    @Test
    void postcodeIsAPrefix() throws Exception {
        mvc.perform(get("/api/listings").param("postcode", "301"))
                .andExpect(jsonPath("$[*].id").value(contains(2, 1012, 1008)));
    }

    @Test
    void soldListingsAreHidden() throws Exception {
        Listing phone = listings.findById(1019L).orElseThrow();
        phone.setStatus(ListingStatus.SOLD);
        listings.save(phone);
        try {
            mvc.perform(get("/api/listings").param("q", "galaxy"))
                    .andExpect(jsonPath("$.length()").value(0));
        } finally {
            phone.setStatus(ListingStatus.AVAILABLE);
            listings.save(phone);
        }
    }

    @Test
    void detail() throws Exception {
        mvc.perform(get("/api/listings/2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Dell UltraSharp U2719D monitor"))
                .andExpect(jsonPath("$.attributes.Model").value("U2719D"))
                .andExpect(jsonPath("$.createdAt").value("2026-10-21T14:30:00Z"));
    }

    @Test
    void unknownIdIs404ProblemDetails() throws Exception {
        mvc.perform(get("/api/listings/999"))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.detail").value("Listing not found."));
    }
}
