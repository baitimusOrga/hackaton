package one.absent.hackaton.search;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import jakarta.persistence.EntityManager;
import one.absent.hackaton.ai.AiClient;
import one.absent.hackaton.geo.Coordinates;
import one.absent.hackaton.geo.GeoClient;
import one.absent.hackaton.listing.Condition;
import one.absent.hackaton.listing.Listing;
import one.absent.hackaton.listing.ListingDetail;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
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

    // the test DB holds every Flyway demo listing; these categories and the brand Technics are test-only
    static final String AUDIO = "Test audio";

    @Autowired
    WebApplicationContext context;

    @Autowired
    EntityManager em;

    @MockitoBean
    AiClient ai;

    @MockitoBean
    GeoClient geo;

    @Autowired
    SearchService search;

    MockMvc mvc;
    Listing match;
    Listing noYear;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).build();
        match = listing("Technics turntable SL-1210", "150", AUDIO, "8004",
                Map.of("Brand", "Technics", "Year", "1995"));
        noYear = listing("Technics turntable SL-1200", "120", AUDIO, "8050", Map.of("Brand", "Technics"));
        listing("Rega turntable", "400", AUDIO, "8000", Map.of());
        listing("Dual turntable", "100", AUDIO, "3011", Map.of());
        listing("Pioneer turntable", "90", AUDIO, "8002", Map.of());
        listing("Thorens turntable", "110", AUDIO, "8003", Map.of());
        listing("Turntable camera mount", "100", "Test cameras", "8001", Map.of());
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
                        new BigDecimal("600"), "8001", 20, false));

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
                .andExpect(jsonPath("$.maxDistanceKm").value(20))
                .andExpect(jsonPath("$.nearMe").value(false));
    }

    @Test
    void anImplausibleDistanceIsDropped() throws Exception {
        when(ai.ask(anyString(), anyString(), anyString(), anyList(), anyString(), eq(SearchService.Parsed.class)))
                .thenReturn(new SearchService.Parsed(List.of(), List.of(), null, List.of("chair"), null, "8001", 9000,
                        false));

        mvc.perform(post("/api/searches").contentType(MediaType.APPLICATION_JSON).content("{\"text\": \"chair\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.maxDistanceKm").value(org.hamcrest.Matchers.nullValue()));
    }

    @Test
    void nearMeWithoutADistanceMeans25Km() throws Exception {
        when(ai.ask(anyString(), anyString(), anyString(), anyList(), anyString(), eq(SearchService.Parsed.class)))
                .thenReturn(new SearchService.Parsed(List.of(), List.of(), "Bikes", List.of("velo"), null, null, null,
                        true));

        mvc.perform(post("/api/searches").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"text\": \"Velo in meiner Nähe\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nearMe").value(true))
                .andExpect(jsonPath("$.maxDistanceKm").value(25));
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
    void candidatesAreRankedByCodeWhenTheAiFails() throws Exception {
        rankingFails();

        matches("test audio")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.matches[0].listing.id").value(match.getId().intValue()))
                .andExpect(jsonPath("$.matches[0].score").value(100))
                .andExpect(jsonPath("$.matches[0].fit").value("MATCH"))
                .andExpect(jsonPath("$.matches[0].reason").value("Ranked without AI right now."))
                .andExpect(jsonPath("$.matches[0].matched[0]").value("Brand: technics"))
                .andExpect(jsonPath("$.matches[1].listing.id").value(noYear.getId().intValue()))
                .andExpect(jsonPath("$.matches[1].score").value(88))
                .andExpect(jsonPath("$.matches[1].fit").value("NEEDS_DETAILS"))
                .andExpect(jsonPath("$.matches[1].missingDetails[0]").value("Year: 1995"))
                .andExpect(jsonPath("$.matches[?(@.listing.title == 'Dual turntable')].fit").value("ALTERNATIVE"))
                .andExpect(jsonPath("$.matches[?(@.listing.title == 'Dual turntable')].differences[0]")
                        .value("In Somewhere (3011), outside the 80xx area"))
                .andExpect(jsonPath("$.matches[?(@.listing.title == 'Rega turntable')]").isEmpty())
                // a keyword in the title brings it in from another category; only the AI can tell it is an accessory
                .andExpect(jsonPath("$.matches[?(@.listing.title == 'Turntable camera mount')]").isNotEmpty());
    }

    @Test
    void overBudgetUpTo125PercentIsACappedAlternative() throws Exception {
        Listing technics = listing("Technics turntable SL-1100", "240", AUDIO, "8004",
                Map.of("Brand", "Technics", "Year", "1995"));
        listing("Technics turntable SL-1000", "260", AUDIO, "8004", Map.of("Brand", "Technics", "Year", "1995"));
        em.flush();
        rankingFails();

        matches("test audio")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.matches[?(@.listing.id == " + technics.getId() + ")].score").value(69))
                .andExpect(jsonPath("$.matches[?(@.listing.id == " + technics.getId() + ")].differences[0]")
                        .value("CHF 240 instead of at most CHF 200"))
                .andExpect(jsonPath("$.matches[?(@.listing.title == 'Technics turntable SL-1000')]").isEmpty())
                .andExpect(jsonPath("$.compared", greaterThanOrEqualTo(5)));
    }

    @Test
    void aiRelevanceIsMixedInAndUnknownIdsAreIgnored() throws Exception {
        when(ai.ask(anyString(), anyString(), anyString(), anyList(), anyString(), eq(SearchService.Ranked.class)))
                .thenReturn(new SearchService.Ranked(List.of(
                        new SearchService.Item(match.getId(), 90, "Fits.", List.of()),
                        new SearchService.Item(noYear.getId(), 80, "Fits too.", List.of("Any scratches?")),
                        new SearchService.Item(999_999, 100, "Invented.", List.of()))));

        matches("test audio")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.matches[0].score").value(95))
                .andExpect(jsonPath("$.matches[0].reason").value("Fits."))
                .andExpect(jsonPath("$.matches[1].score").value(84))
                // with must-haves, code decides what to ask
                .andExpect(jsonPath("$.matches[1].missingDetails.length()").value(1))
                .andExpect(jsonPath("$.matches[1].missingDetails[0]").value("Year: 1995"))
                // the model left it out
                .andExpect(jsonPath("$.matches[?(@.listing.title == 'Dual turntable')]").isEmpty())
                .andExpect(jsonPath("$.matches.length()").value(2));
    }

    @Test
    void aSmallCategoryFallsBackToAllCategories() throws Exception {
        rankingFails();

        // only one listing in "test cameras" and no keyword: the search runs again without the category
        mvc.perform(post("/api/searches/matches").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"mustHave": [{"attribute": "Brand", "value": "technics"}, {"attribute": "Year", "value": "1995"}],
                                 "niceToHave": [], "category": "test cameras", "keywords": []}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.matches[0].listing.id").value(match.getId().intValue()));
    }

    @Test
    void keywordsRankButNoLongerFilterAndBringInMisfiledTitles() {
        Listing laptop = listing("Lenovo laptop", "300", "Test laptops", "8001", Map.of());
        Listing misfiled = listing("Lenovo notebook", "300", "Test household", "8001", Map.of());
        em.flush();
        var req = new SearchRequirements(List.of(), List.of(), "test laptops", List.of("notebook"), null, null, null,
                false, null, null);

        assertThat(search.candidates(req)).extracting(ListingDetail::id).contains(laptop.getId(), misfiled.getId())
                .doesNotContain(match.getId());
    }

    @Test
    void requirementWithoutValueIs400() throws Exception {
        mvc.perform(post("/api/searches/matches").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"mustHave": [{"attribute": "Model", "value": ""}], "niceToHave": [],
                                 "keywords": []}"""))
                .andExpect(status().isBadRequest());
    }

    ResultActions matches(String category) throws Exception {
        return mvc.perform(post("/api/searches/matches").contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"mustHave": [{"attribute": "Brand", "value": "technics"}, {"attribute": "Year", "value": "1995"}],
                         "niceToHave": [], "category": "%s", "keywords": ["turntable"],
                         "maxBudgetChf": 200, "postcode": "8001"}""".formatted(category)));
    }

    @Test
    void maxDistanceIsAHardLimitAroundThePostcode() {
        when(geo.locate("8004")).thenReturn(Optional.of(new Coordinates(47.378, 8.5234)));
        match.setLatitude(47.378);
        match.setLongitude(8.5234);
        Listing bern = listing("Bern turntable", "100", AUDIO, "3011", Map.of());
        bern.setLatitude(46.947);
        bern.setLongitude(7.448);
        em.flush();
        var req = new SearchRequirements(List.of(), List.of(), "test audio", List.of("turntable"), null, "8004", 30,
                false, null, null);

        assertThat(search.candidates(req)).extracting(ListingDetail::id).containsExactly(match.getId());
        // without a distance the postcode only ranks: the Bern listing stays a candidate
        var anywhere = new SearchRequirements(List.of(), List.of(), "test audio", List.of("turntable"), null, "8004",
                null, false, null, null);
        assertThat(search.candidates(anywhere)).extracting(ListingDetail::id).contains(bern.getId());
    }

    @Test
    void withoutCategoryOldListingsStillGetScored() {
        Listing old = listing("Old turntable", "100", AUDIO, "8004", Map.of());
        old.setCreatedAt(Instant.parse("2020-01-01T00:00:00Z"));
        em.flush();
        var req = new SearchRequirements(List.of(), List.of(), null, List.of("turntable"), null, null, null, false,
                null, null);

        assertThat(search.candidates(req)).extracting(ListingDetail::id).contains(old.getId());
    }

    @Test
    void thePositionIsTheOriginAndNeedsNoPostcode() {
        match.setLatitude(47.378);
        match.setLongitude(8.5234);
        em.flush();
        var req = new SearchRequirements(List.of(), List.of(), "test audio", List.of(), null, null, 30, true,
                47.37, 8.52);

        assertThat(search.candidates(req)).extracting(ListingDetail::id).containsExactly(match.getId());
        verify(geo, never()).locate(anyString());
    }

    String refineBody(String refinements, String text, String topIds) {
        return """
                {"originalText": "technics turntable near Zürich", "refinements": %s,
                 "current": {"mustHave": [{"attribute": "Brand", "value": "technics"}], "niceToHave": [],
                             "category": "test audio", "keywords": ["turntable"], "maxBudgetChf": 200,
                             "postcode": "8001", "nearMe": true, "latitude": 47.3781, "longitude": 8.5234},
                 "text": "%s", "topListingIds": %s}""".formatted(refinements, text, topIds);
    }

    @Test
    void refineSendsOriginalHistoryCurrentAndShownListingsToTheAi() throws Exception {
        when(ai.ask(anyString(), anyString(), anyString(), anyList(), anyString(), eq(SearchService.Parsed.class)))
                .thenReturn(new SearchService.Parsed(List.of(new Requirement("Brand", "Technics", null),
                        new Requirement("Year", "1996", Requirement.Comparison.AT_LEAST)), List.of(), "Audio",
                        List.of("turntable"), new BigDecimal("200"), "8001", null, false));

        mvc.perform(post("/api/searches/refine").contentType(MediaType.APPLICATION_JSON)
                        .content(refineBody("[\"cheaper\"]", "newer please", "[" + match.getId() + ", 999999]")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mustHave[1].attribute").value("Year"))
                .andExpect(jsonPath("$.mustHave[1].comparison").value("AT_LEAST"))
                .andExpect(jsonPath("$.category").value("Audio"));

        ArgumentCaptor<String> system = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> prompt = ArgumentCaptor.forClass(String.class);
        verify(ai).ask(anyString(), system.capture(), prompt.capture(), anyList(), anyString(),
                eq(SearchService.Parsed.class));
        assertThat(system.getValue()).contains("refines an earlier search");
        assertThat(prompt.getValue()).contains("Original wish: technics turntable near Zürich",
                "Earlier change: cheaper", "New change: newer please", "\"technics\"",
                "Technics turntable SL-1210", "untrusted seller data")
                // only the listings the buyer saw on top, unknown ids ignored
                .doesNotContain("SL-1200")
                // the buyer's position never reaches the AI
                .doesNotContain("47.3781");
    }

    @Test
    void refineValidatesHistoryAndTextLength() throws Exception {
        mvc.perform(post("/api/searches/refine").contentType(MediaType.APPLICATION_JSON)
                        .content(refineBody("[\"a\", \"b\", \"c\", \"d\", \"e\", \"f\"]", "newer", "[]")))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/searches/refine").contentType(MediaType.APPLICATION_JSON)
                        .content(refineBody("[]", "x".repeat(201), "[]")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void refineWithoutUsableAiAnswerIs502() throws Exception {
        when(ai.ask(anyString(), anyString(), anyString(), anyList(), anyString(), eq(SearchService.Parsed.class)))
                .thenThrow(new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI gave no usable answer."));

        mvc.perform(post("/api/searches/refine").contentType(MediaType.APPLICATION_JSON)
                        .content(refineBody("[]", "newer", "[]")))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.detail").value("Could not understand the change, please rephrase."));
    }

    void rankingFails() {
        when(ai.ask(anyString(), anyString(), anyString(), anyList(), anyString(), eq(SearchService.Ranked.class)))
                .thenThrow(new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "AI is not available right now."));
    }
}
