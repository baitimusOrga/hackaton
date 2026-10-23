package one.absent.hackaton.config;

import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@ActiveProfiles("test")
class SecurityTest {
    @Autowired WebApplicationContext context;
    @MockitoBean JwtDecoder decoder;
    MockMvc mvc;
    @BeforeEach void setup() { mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build(); }

    @Test void anonymousWritesAreProblemDetails() throws Exception {
        mvc.perform(post("/api/listings")).andExpect(status().isUnauthorized())
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
            .andExpect(jsonPath("$.detail").value("Please log in."));
    }
    @Test void invalidBearerIsProblemDetails() throws Exception {
        when(decoder.decode("invalid")).thenThrow(new BadJwtException("invalid"));
        mvc.perform(post("/api/listings").header("Authorization", "Bearer invalid"))
            .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.detail").value("Please log in."));
    }
    @Test void unlistedRoutesAreDeniedByDefault() throws Exception {
        mvc.perform(get("/api/clearance/projects")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/does-not-exist")).andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/listings/1")).andExpect(status().isUnauthorized());
    }
    @Test void publicRoutesStayOpen() throws Exception {
        mvc.perform(get("/api/listings")).andExpect(status().isOk());
        mvc.perform(get("/api/openapi.json")).andExpect(status().isOk());
        mvc.perform(post("/api/searches").contentType(MediaType.APPLICATION_JSON).content("{\"text\":\"bike\"}"))
            .andExpect(status().is(org.hamcrest.Matchers.not(401)));
    }
    @Test void oversizedSearchRequirementsAreRejected() throws Exception {
        var item = "{\"attribute\":\"a\",\"value\":\"b\"}";
        var many = String.join(",", java.util.Collections.nCopies(21, item));
        mvc.perform(post("/api/searches/matches").contentType(MediaType.APPLICATION_JSON)
                .content("{\"mustHave\":[" + many + "],\"niceToHave\":[],\"keywords\":[],\"acceptUnknown\":false}"))
            .andExpect(status().isBadRequest());
    }
    @Test void publicReadsRemainPublic() throws Exception {
        mvc.perform(get("/api/info")).andExpect(status().isOk());
        mvc.perform(get("/actuator/health")).andExpect(status().isOk());
    }
}
