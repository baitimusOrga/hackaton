package one.absent.hackaton.selling;

import static org.hamcrest.Matchers.nullValue;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doThrow;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

import javax.imageio.ImageIO;

import one.absent.hackaton.ai.AiClient;
import one.absent.hackaton.listing.Condition;
import one.absent.hackaton.listing.ListingRepository;
import one.absent.hackaton.selling.ListingDraft.DraftFact;
import one.absent.hackaton.selling.ListingDraft.FactSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.server.ResponseStatusException;
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
    static final byte[] PNG = image("png");
    @Autowired WebApplicationContext context;
    @Autowired PhotoRepository photos;
    @Autowired ListingRepository listings;
    @Autowired JsonMapper json;
    @Autowired PhotoCleanup cleanup;
    @MockitoBean AiClient ai;
    MockMvc mvc;

    @BeforeEach void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    private static MockMultipartFile photo(String type) {
        return new MockMultipartFile("photos", "item", type, PNG);
    }

    static byte[] image(String format) {
        try {
            var out = new ByteArrayOutputStream();
            ImageIO.write(new BufferedImage(4, 2, BufferedImage.TYPE_INT_RGB), format, out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    @Test void draftFromOnePhotoStoresItAndReturnsFactsQuestionsAndPrice() throws Exception {
        when(ai.ask(anyString(), anyString(), anyList(), anyString(), eq(DraftController.AiDraft.class)))
                .thenReturn(new DraftController.AiDraft("Monitors", "Dell U2719D monitor", "A 27 inch monitor.",
                        null, List.of(new DraftFact("Brand", "Dell", FactSource.LABEL, null),
                        new DraftFact("Size", "27\"", FactSource.SUGGESTION, null)),
                        List.of("Please photograph the model label."),
                        List.of(new ListingDraft.PrivacyWarning(1, "Shows a serial number."))));
        long before = photos.count();
        String body = mvc.perform(multipart("/api/listing-drafts").file(photo("image/png"))
                        .with(jwt().jwt(j -> j.subject("seller"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.category").value("Monitors"))
                .andExpect(jsonPath("$.condition").value(nullValue()))
                .andExpect(jsonPath("$.privacyWarnings[0].photo").value(1))
                .andExpect(jsonPath("$.facts[0].source").value("LABEL"))
                .andExpect(jsonPath("$.questions[0]").value("Please photograph the model label."))
                // price numbers depend on the demo listings (V4/V6); PriceEstimatorTest covers the math
                .andExpect(jsonPath("$.price.evidence[0].title").exists())
                .andExpect(jsonPath("$.price.explanation").isNotEmpty())
                .andReturn().getResponse().getContentAsString();
        assertThat(photos.count()).isEqualTo(before + 1);
        long photoId = json.readTree(body).path("photoIds").get(0).asLong();

        // a draft photo is not public, not even for its seller
        mvc.perform(get("/api/photos/" + photoId)).andExpect(status().isNotFound());
        mvc.perform(get("/api/photos/" + photoId).with(jwt().jwt(j -> j.subject("seller"))))
                .andExpect(status().isNotFound());

        String listing = """
            {"title":"Monitor","description":"Good monitor","category":"Monitors","condition":"GOOD",
             "priceChf":100,"postcode":"8004","locality":"Zürich","attributes":{},"photoIds":[%d]}
            """.formatted(photoId);
        mvc.perform(post("/api/listings").with(jwt().jwt(j -> j.subject("seller")))
                        .contentType(MediaType.APPLICATION_JSON).content(listing))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.imageUrl").value("/api/photos/" + photoId));
        Photo published = photos.findById(photoId).orElseThrow();
        assertThat(published.getListingId()).isNotNull();
        mvc.perform(get("/api/photos/" + photoId))
                .andExpect(status().isOk())
                .andExpect(content().contentType("image/png"))
                .andExpect(content().bytes(published.getData()))
                .andExpect(header().string("Cache-Control", "max-age=86400, public"));
        // a published photo cannot be used again
        mvc.perform(post("/api/listings").with(jwt().jwt(j -> j.subject("seller")))
                        .contentType(MediaType.APPLICATION_JSON).content(listing))
                .andExpect(status().isBadRequest());
    }

    @Test void shortTitleCutsAtAWordBoundary() {
        String title = "Apple iMac 27 inch Retina 5K 2017 with Intel Core i5 and 16 GB RAM and 1 TB Fusion Drive";
        String cut = DraftController.shortTitle(title);
        assertThat(cut.length()).isLessThanOrEqualTo(60);
        assertThat(title).startsWith(cut + " ");
        assertThat(DraftController.shortTitle("Dell U2719D")).isEqualTo("Dell U2719D");
    }

    @Test void wrongTypeIsRejected() throws Exception {
        mvc.perform(multipart("/api/listing-drafts").file(photo("application/pdf"))
                        .with(jwt().jwt(j -> j.subject("seller"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Photos must be JPEG, PNG, GIF or WebP images."));
    }

    @Test void missingContentTypeIsRejected() throws Exception {
        mvc.perform(multipart("/api/listing-drafts").file(new MockMultipartFile("photos", "item", null, PNG))
                        .with(jwt().jwt(j -> j.subject("seller"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Photos must be JPEG, PNG, GIF or WebP images."));
    }

    @Test void corruptImageIsRejected() throws Exception {
        mvc.perform(multipart("/api/listing-drafts")
                        .file(new MockMultipartFile("photos", "item", "image/png", new byte[] {(byte) 0x89, 'P', 'N', 'G'}))
                        .with(jwt().jwt(j -> j.subject("seller"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Unsupported or corrupt image"));
    }

    @Test void failedAiCallDeletesTheUploadedPhotos() throws Exception {
        doThrow(new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "AI down")).when(ai)
                .ask(anyString(), anyString(), anyList(), anyString(), eq(DraftController.AiDraft.class));
        long before = photos.count();
        mvc.perform(multipart("/api/listing-drafts").file(photo("image/png"))
                        .with(jwt().jwt(j -> j.subject("seller"))))
                .andExpect(status().isServiceUnavailable());
        assertThat(photos.count()).isEqualTo(before);
    }

    @Test void cleanupDeletesOnlyOldUnpublishedPhotos() {
        Instant old = Instant.now().minus(Duration.ofHours(25));
        Photo orphan = savePhoto(old, null);
        Photo published = savePhoto(old, listings.findAll().getFirst().getId());
        Photo recent = savePhoto(Instant.now(), null);
        cleanup.deleteOrphans();
        assertThat(photos.findById(orphan.getId())).isEmpty();
        assertThat(photos.findById(published.getId())).isPresent();
        assertThat(photos.findById(recent.getId())).isPresent();
    }

    private Photo savePhoto(Instant createdAt, Long listingId) {
        var photo = new Photo();
        photo.setContentType("image/png");
        photo.setData(PNG);
        photo.setSellerId("seller");
        photo.setCreatedAt(createdAt);
        photo.setListingId(listingId);
        return photos.save(photo);
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
