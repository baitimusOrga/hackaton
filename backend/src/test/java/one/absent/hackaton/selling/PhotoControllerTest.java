package one.absent.hackaton.selling;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import one.absent.hackaton.listing.ListingRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class PhotoControllerTest {
    static final byte[] PNG = DraftControllerTest.image("png");
    @Autowired WebApplicationContext context;
    @Autowired PhotoRepository photos;
    @Autowired JsonMapper json;
    @Autowired ListingRepository listings;
    MockMvc mvc;

    @BeforeEach void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    static MockMultipartFile photo(String type) {
        return new MockMultipartFile("photos", "item", type, PNG);
    }

    @Test void uploadStoresEachPhotoOnceAndServesItOnlyOncePublished() throws Exception {
        long before = photos.count();
        String body = mvc.perform(multipart("/api/photos").file(photo("image/png")).file(photo("image/png"))
                        .with(jwt().jwt(j -> j.subject("seller"))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertThat(photos.count()).isEqualTo(before + 2);
        long id = json.readTree(body).get(0).asLong();
        Photo photo = photos.findById(id).orElseThrow();
        assertThat(photo.getSellerId()).isEqualTo("seller");

        // a draft photo is not public, not even for its seller
        mvc.perform(get("/api/photos/" + id).with(jwt().jwt(j -> j.subject("seller"))))
                .andExpect(status().isNotFound());
        photo.setListingId(listings.findAll().getFirst().getId());
        mvc.perform(get("/api/photos/" + id))
                .andExpect(status().isOk())
                .andExpect(content().contentType("image/png"))
                .andExpect(content().bytes(photo.getData()))
                .andExpect(header().string("Cache-Control", "no-cache, public"));
    }

    @Test void theBrowserRevalidatesAndGetsANewPhotoWhenTheIdIsReused() throws Exception {
        String body = mvc.perform(multipart("/api/photos").file(photo("image/png"))
                        .with(jwt().jwt(j -> j.subject("seller"))))
                .andReturn().getResponse().getContentAsString();
        Photo photo = photos.findById(json.readTree(body).get(0).asLong()).orElseThrow();
        photo.setListingId(listings.findAll().getFirst().getId());
        String etag = mvc.perform(get("/api/photos/" + photo.getId()))
                .andExpect(status().isOk())
                .andReturn().getResponse().getHeader("ETag");

        mvc.perform(get("/api/photos/" + photo.getId()).header("If-None-Match", etag))
                .andExpect(status().isNotModified())
                .andExpect(header().string("ETag", etag))
                .andExpect(header().doesNotExist("Cache-Control")) // the browser keeps the one from the 200
                .andExpect(content().bytes(new byte[0]));
        // same id, other upload (as after a database reset): the cached copy no longer matches
        photo.setCreatedAt(photo.getCreatedAt().plusSeconds(1));
        mvc.perform(get("/api/photos/" + photo.getId()).header("If-None-Match", etag))
                .andExpect(status().isOk())
                .andExpect(content().bytes(photo.getData()));
    }

    @Test void wrongTypeIsRejected() throws Exception {
        mvc.perform(multipart("/api/photos").file(photo("application/pdf"))
                        .with(jwt().jwt(j -> j.subject("seller"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Photos must be JPEG, PNG, GIF or WebP images."));
    }

    @Test void missingContentTypeIsRejected() throws Exception {
        mvc.perform(multipart("/api/photos").file(new MockMultipartFile("photos", "item", null, PNG))
                        .with(jwt().jwt(j -> j.subject("seller"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Photos must be JPEG, PNG, GIF or WebP images."));
    }

    @Test void corruptImageIsRejected() throws Exception {
        mvc.perform(multipart("/api/photos")
                        .file(new MockMultipartFile("photos", "item", "image/png", new byte[] {(byte) 0x89, 'P', 'N', 'G'}))
                        .with(jwt().jwt(j -> j.subject("seller"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Unsupported or corrupt image"));
    }

    @Test void uploadRequiresAuthentication() throws Exception {
        mvc.perform(multipart("/api/photos").file(photo("image/png")))
                .andExpect(status().isUnauthorized());
    }

    @Test void unknownPhotoIsNotFound() throws Exception {
        mvc.perform(get("/api/photos/999999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("Photo not found."));
    }
}
