package one.absent.hackaton.selling;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.List;

import one.absent.hackaton.ai.AiClient;
import one.absent.hackaton.listing.Condition;
import one.absent.hackaton.listing.ListingRepository;
import one.absent.hackaton.selling.ListingDraft.DraftFact;
import one.absent.hackaton.selling.ListingDraft.FactSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class DraftControllerTest {
    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 1, 2, 3};
    @Autowired WebApplicationContext context;
    @Autowired PhotoRepository photos;
    @Autowired ListingRepository listings;
    @Autowired JsonMapper json;
    @MockitoBean AiClient ai;
    MockMvc mvc;

    @BeforeEach void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    private static MockMultipartFile photo(String type) {
        return new MockMultipartFile("photos", "item", type, PNG);
    }

    @Test void draftFromOnePhotoStoresItAndReturnsFactsQuestionsAndPrice() throws Exception {
        when(ai.ask(anyString(), anyString(), anyList(), anyString(), eq(DraftController.AiDraft.class)))
                .thenReturn(new DraftController.AiDraft("Monitors", "Dell U2719D monitor", "A 27 inch monitor.",
                        Condition.GOOD, List.of(new DraftFact("Brand", "Dell", FactSource.LABEL),
                        new DraftFact("Size", "27\"", FactSource.SUGGESTION)),
                        List.of("Please photograph the model label.")));
        long before = photos.count();
        String body = mvc.perform(multipart("/api/listing-drafts").file(photo("image/png"))
                        .with(jwt().jwt(j -> j.subject("seller"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.category").value("Monitors"))
                .andExpect(jsonPath("$.facts[0].source").value("LABEL"))
                .andExpect(jsonPath("$.questions[0]").value("Please photograph the model label."))
                .andExpect(jsonPath("$.price.midChf").value(120))
                .andExpect(jsonPath("$.price.provisional").value(true))
                .andReturn().getResponse().getContentAsString();
        assertThat(photos.count()).isEqualTo(before + 1);
        long photoId = json.readTree(body).path("photoIds").get(0).asLong();

        mvc.perform(get("/api/photos/" + photoId))
                .andExpect(status().isOk())
                .andExpect(content().contentType("image/png"))
                .andExpect(content().bytes(PNG))
                .andExpect(header().string("Cache-Control", "max-age=86400, public"));

        String listing = """
            {"title":"Monitor","description":"Good monitor","category":"Monitors","condition":"GOOD",
             "priceChf":100,"postcode":"8004","locality":"Zürich","attributes":{},"photoIds":[%d]}
            """.formatted(photoId);
        mvc.perform(post("/api/listings").with(jwt().jwt(j -> j.subject("seller")))
                        .contentType(MediaType.APPLICATION_JSON).content(listing))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.imageUrl").value("/api/photos/" + photoId));
        assertThat(photos.findById(photoId).orElseThrow().getListingId()).isNotNull();
        // a published photo cannot be used again
        mvc.perform(post("/api/listings").with(jwt().jwt(j -> j.subject("seller")))
                        .contentType(MediaType.APPLICATION_JSON).content(listing))
                .andExpect(status().isBadRequest());
    }

    @Test void wrongTypeIsRejected() throws Exception {
        mvc.perform(multipart("/api/listing-drafts").file(photo("application/pdf"))
                        .with(jwt().jwt(j -> j.subject("seller"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Photos must be JPEG, PNG, GIF or WebP images."));
    }

    @Test void draftRequiresAuthentication() throws Exception {
        mvc.perform(multipart("/api/listing-drafts").file(photo("image/png")))
                .andExpect(status().isUnauthorized());
    }

    @Test void unknownPhotoIsNotFound() throws Exception {
        mvc.perform(get("/api/photos/999999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("Photo not found."));
    }
}
