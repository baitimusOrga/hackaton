package one.absent.hackaton.listing;

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

    @Test
    void listReturnsTheSampleListings() throws Exception {
        mvc.perform(get("/api/listings").param("q", "imac").param("maxPrice", "500"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].priceChf").value(450.00))
                .andExpect(jsonPath("$[0].condition").value("GOOD"))
                .andExpect(jsonPath("$[0].description").doesNotExist());
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
