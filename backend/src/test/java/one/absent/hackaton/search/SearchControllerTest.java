package one.absent.hackaton.search;

import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import jakarta.persistence.EntityManager;
import one.absent.hackaton.ai.AiClient;
import one.absent.hackaton.listing.Condition;
import one.absent.hackaton.listing.Listing;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.server.ResponseStatusException;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class SearchControllerTest {

    @Autowired
    WebApplicationContext context;

    @Autowired
    EntityManager em;

    @MockitoBean
    AiClient ai;

    MockMvc mvc;
    Listing match;
    Listing noYear;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).build();
        match = listing("Technics turntable SL-1210", "150", "Audio", "8004",
                Map.of("Brand", "Technics", "Year", "1995"));
        noYear = listing("Technics turntable SL-1200", "120", "Audio", "8050", Map.of("Brand", "Technics"));
        listing("Rega turntable", "400", "Audio", "8000", Map.of());
        listing("Dual turntable", "100", "Audio", "3011", Map.of());
        listing("Turntable camera mount", "100", "Cameras", "8001", Map.of());
        em.flush();
    }

    Listing listing(String title, String price, String category, String postcode, Map<String, String> attributes) {
        Listing l = new Listing();
        l.setTitle(title);
        l.setDescription("Test listing.");
        l.setPriceChf(new BigDecimal(price));
        l.setCondition(Condition.GOOD);
        l.setCategory(category);
        l.setPostcode(postcode);
        l.setLocality("Somewhere");
        l.setCreatedAt(Instant.now());
        l.getAttributes().putAll(attributes);
        em.persist(l);
        return l;
    }

    @Test
    void textBecomesCanonicalRequirements() throws Exception {
        when(ai.ask(anyString(), anyString(), anyString(), anyList(), anyString(), eq(SearchService.Parsed.class)))
                .thenReturn(new SearchService.Parsed(
                        List.of(new Requirement("model", "iMac", Requirement.Comparison.AT_LEAST),
                                new Requirement("Accessories", "mouse", null)),
                        List.of(new Requirement("Year", "2017", Requirement.Comparison.AT_LEAST)), "computers", List.of(" iMac ", "Apple"),
                        new BigDecimal("600"), "8001"));

        mvc.perform(post("/api/searches").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"text\": \"working iMac 27 5K from 2017, max 600 CHF near Zürich\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mustHave.length()").value(1))
                .andExpect(jsonPath("$.mustHave[0].attribute").value("Model"))
                .andExpect(jsonPath("$.mustHave[0].comparison").value("EXACT"))
                .andExpect(jsonPath("$.niceToHave[0].comparison").value("AT_LEAST"))
                .andExpect(jsonPath("$.niceToHave[0].value").value("2017"))
                .andExpect(jsonPath("$.category").value("Computers"))
                .andExpect(jsonPath("$.keywords[0]").value("imac"))
                .andExpect(jsonPath("$.keywords[1]").value("apple"))
                .andExpect(jsonPath("$.maxBudgetChf").value(600))
                .andExpect(jsonPath("$.postcode").value("8001"))
                .andExpect(jsonPath("$.acceptUnknown").value(true));
    }

    @Test
    void unreadableAiAnswerIs502() throws Exception {
        when(ai.ask(anyString(), anyString(), anyString(), anyList(), anyString(), eq(SearchService.Parsed.class)))
                .thenThrow(new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI gave no usable answer."));

        mvc.perform(post("/api/searches").contentType(MediaType.APPLICATION_JSON).content("{\"text\": \"chair\"}"))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.detail").value("Could not understand the search, please rephrase."));
    }

    @Test
    void blankTextIs400() throws Exception {
        mvc.perform(post("/api/searches").contentType(MediaType.APPLICATION_JSON).content("{\"text\": \" \"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.text").exists());
    }

    @Test
    void candidatesAreFilteredAndShownWithoutAiWhenItFails() throws Exception {
        rankingFails();

        matches(true)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.confirmed.length()").value(1))
                .andExpect(jsonPath("$.confirmed[0].listing.id").value(match.getId().intValue()))
                .andExpect(jsonPath("$.possible.length()").value(1))
                .andExpect(jsonPath("$.possible[0].listing.id").value(noYear.getId().intValue()))
                .andExpect(jsonPath("$.possible[0].reason").value("Ranked without AI right now."))
                .andExpect(jsonPath("$.alternatives[?(@.listing.title == 'Dual turntable')].differences[0]")
                        .value("In Somewhere (3011), outside the 80xx area"));
    }

    @Test
    void overBudgetUpTo125PercentIsAlternativeWithDifference() throws Exception {
        Listing technics = listing("Technics turntable SL-1100", "240", "Audio", "8004",
                Map.of("Brand", "Technics", "Year", "1995"));
        listing("Technics turntable SL-1000", "260", "Audio", "8004", Map.of("Brand", "Technics", "Year", "1995"));
        em.flush();
        rankingFails();

        matches(true)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.alternatives[?(@.listing.id == " + technics.getId() + ")].differences[0]")
                        .value("CHF 240 instead of at most CHF 200"))
                .andExpect(jsonPath("$.alternatives[?(@.listing.title == 'Technics turntable SL-1000')]").isEmpty())
                .andExpect(jsonPath("$.compared", greaterThanOrEqualTo(4)));
    }

    @Test
    void unprovenConfirmedIsDowngradedAndUnknownIdsDropped() throws Exception {
        rankingAnswers();

        matches(true)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.confirmed.length()").value(1))
                .andExpect(jsonPath("$.confirmed[0].listing.id").value(match.getId().intValue()))
                .andExpect(jsonPath("$.possible.length()").value(1))
                .andExpect(jsonPath("$.possible[0].listing.id").value(noYear.getId().intValue()))
                .andExpect(jsonPath("$.possible[0].missingDetails[0]").value("Year: 1995"))
                .andExpect(jsonPath("$.alternatives.length()").value(0));
    }

    @Test
    void withoutAcceptUnknownPossibleIsEmpty() throws Exception {
        rankingAnswers();

        matches(false)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.confirmed.length()").value(1))
                .andExpect(jsonPath("$.possible.length()").value(0));
    }

    @Test
    void requirementWithoutValueIs400() throws Exception {
        mvc.perform(post("/api/searches/matches").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"mustHave": [{"attribute": "Model", "value": ""}], "niceToHave": [],
                                 "keywords": []}"""))
                .andExpect(status().isBadRequest());
    }

    ResultActions matches(boolean acceptUnknown) throws Exception {
        return mvc.perform(post("/api/searches/matches").contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"mustHave": [{"attribute": "Brand", "value": "technics"}, {"attribute": "Year", "value": "1995"}],
                         "niceToHave": [], "category": "audio", "keywords": ["turntable"],
                         "maxBudgetChf": 200, "postcode": "8001", "acceptUnknown": %s}""".formatted(acceptUnknown)));
    }

    void rankingFails() {
        when(ai.ask(anyString(), anyString(), anyString(), anyList(), anyString(), eq(SearchService.Ranked.class)))
                .thenThrow(new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "AI is not available right now."));
    }

    void rankingAnswers() {
        SearchService.Item confirmedMatch = new SearchService.Item(match.getId(), "Fits.", List.of(), List.of());
        SearchService.Item confirmedNoYear = new SearchService.Item(noYear.getId(), "Fits too.", List.of(), List.of());
        SearchService.Item unknown = new SearchService.Item(999_999, "Invented.", List.of(), List.of());
        when(ai.ask(anyString(), anyString(), anyString(), anyList(), anyString(), eq(SearchService.Ranked.class)))
                .thenReturn(new SearchService.Ranked(List.of(confirmedMatch, confirmedNoYear), List.of(unknown),
                        List.of(confirmedMatch)));
    }
}
