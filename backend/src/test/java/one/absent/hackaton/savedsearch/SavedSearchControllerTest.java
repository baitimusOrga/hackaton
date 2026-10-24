package one.absent.hackaton.savedsearch;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class SavedSearchControllerTest {
    private static final String BASE = "/api/saved-searches";
    @Autowired WebApplicationContext context;
    MockMvc mvc;

    @BeforeEach void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    private static RequestPostProcessor user(String subject) {
        return jwt().jwt(j -> j.subject(subject));
    }

    @Test void createListAndOwnership() throws Exception {
        String body = """
                {"name":"Monitor","text":"27 Zoll Monitor","requirements":
                 {"mustHave":[{"attribute":"Size","value":"27","comparison":"AT_LEAST"}],"niceToHave":[],
                  "keywords":["monitor"],"maxBudgetChf":200,"postcode":"8004","maxDistanceKm":25}}
                """;
        String created = mvc.perform(post(BASE).with(user("alice")).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.requirements.mustHave[0].attribute").value("Size"))
                .andReturn().getResponse().getContentAsString();
        String id = created.replaceAll("(?s).*\"id\":(\\d+).*", "$1");

        mvc.perform(get(BASE).with(user("alice")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].name").value("Monitor"))
                .andExpect(jsonPath("$[0].requirements.maxBudgetChf").value(200));
        mvc.perform(get(BASE).with(user("bob"))).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(delete(BASE + "/" + id).with(user("bob"))).andExpect(status().isNotFound());
        mvc.perform(delete(BASE + "/" + id).with(user("alice"))).andExpect(status().isNoContent());
        mvc.perform(get(BASE).with(user("alice"))).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get(BASE)).andExpect(status().isUnauthorized());
    }
}
