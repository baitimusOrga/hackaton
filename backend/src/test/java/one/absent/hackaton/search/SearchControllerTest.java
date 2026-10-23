package one.absent.hackaton.search;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
class SearchControllerTest {

    @Autowired
    WebApplicationContext context;

    MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).build();
    }

    @Test
    void textBecomesRequirements() throws Exception {
        mvc.perform(post("/api/searches").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"text\": \"working iMac 27 5K from 2017, max 600 CHF near Zürich\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mustHave[0].attribute").value("Model"))
                .andExpect(jsonPath("$.niceToHave.length()").value(1))
                .andExpect(jsonPath("$.maxBudgetChf").value(600))
                .andExpect(jsonPath("$.acceptUnknown").value(true));
    }

    @Test
    void blankTextIs400() throws Exception {
        mvc.perform(post("/api/searches").contentType(MediaType.APPLICATION_JSON).content("{\"text\": \" \"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.text").exists());
    }

    @Test
    void requirementsBecomeGroupedMatches() throws Exception {
        mvc.perform(post("/api/searches/matches").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"mustHave": [{"attribute": "Model", "value": "iMac 27"}], "niceToHave": [],
                                 "maxBudgetChf": 600, "acceptUnknown": true}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.confirmed[0].listing.id").value(1))
                .andExpect(jsonPath("$.possible[0].missingDetails.length()").value(2))
                .andExpect(jsonPath("$.alternatives[0].differences[0]").value("CHF 720 instead of at most CHF 600"));
    }

    @Test
    void requirementWithoutValueIs400() throws Exception {
        mvc.perform(post("/api/searches/matches").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"mustHave\": [{\"attribute\": \"Model\", \"value\": \"\"}], \"niceToHave\": []}"))
                .andExpect(status().isBadRequest());
    }
}
