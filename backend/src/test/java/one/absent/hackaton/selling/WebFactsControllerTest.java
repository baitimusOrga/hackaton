package one.absent.hackaton.selling;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.List;

import one.absent.hackaton.ai.AiClient;
import org.mockito.ArgumentCaptor;
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
class WebFactsControllerTest {
    private static final String URL = "/api/listing-drafts/web-facts";
    @Autowired WebApplicationContext context;
    @MockitoBean AiClient ai;
    MockMvc mvc;

    @BeforeEach void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    private static String body(String modelSource) {
        return """
                {"title":"Apple iMac 27","category":"Computers","facts":[
                  {"name":"Brand","value":"Apple","source":"LABEL"},
                  {"name":"Model","value":"iMac18,3","source":"%s"}]}""".formatted(modelSource);
    }

    @Test void keepsOnlyNewAllowedFactsWithUrlAsWeb() throws Exception {
        when(ai.askWithWebSearch(anyString(), anyString(), eq(WebFactsController.AiWebFacts.class)))
                .thenReturn(new WebFactsController.AiWebFacts(List.of(
                        new WebFactsController.WebFact("Resolution", "5120x2880", "https://apple.com/specs"),
                        new WebFactsController.WebFact("Brand", "Apple", "https://apple.com/specs"),
                        new WebFactsController.WebFact("Serial", "C02XYZ", "https://apple.com/specs"),
                        new WebFactsController.WebFact("Year", "2017", null))));

        mvc.perform(post(URL).with(jwt()).contentType(MediaType.APPLICATION_JSON).content(body("LABEL")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].name").value("Resolution"))
                .andExpect(jsonPath("$[0].source").value("WEB"))
                .andExpect(jsonPath("$[0].sourceUrl").value("https://apple.com/specs"));
    }

    @Test void acceptsTheCatalogFactsOfTheCategory() throws Exception {
        when(ai.askWithWebSearch(anyString(), anyString(), eq(WebFactsController.AiWebFacts.class)))
                .thenReturn(new WebFactsController.AiWebFacts(List.of(
                        new WebFactsController.WebFact("Frame size", "M", "https://trek.com/marlin"))));

        mvc.perform(post(URL).with(jwt()).contentType(MediaType.APPLICATION_JSON).content("""
                        {"title":"Trek Marlin 7","category":"Bikes","facts":[
                          {"name":"Model","value":"Marlin 7","source":"SELLER"}]}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Frame size"));
        ArgumentCaptor<String> text = ArgumentCaptor.forClass(String.class);
        verify(ai).askWithWebSearch(anyString(), text.capture(), eq(WebFactsController.AiWebFacts.class));
        assertThat(text.getValue()).contains("Key facts for Bikes: Brand, Model, Frame size");
    }

        @Test void needsAConfirmedModel() throws Exception {
        mvc.perform(post(URL).with(jwt()).contentType(MediaType.APPLICATION_JSON).content(body("SUGGESTION")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Please confirm the model first, then we can look it up."));
        verifyNoInteractions(ai);
    }

    @Test void requiresLogin() throws Exception {
        mvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content(body("LABEL")))
                .andExpect(status().isUnauthorized());
    }
}
