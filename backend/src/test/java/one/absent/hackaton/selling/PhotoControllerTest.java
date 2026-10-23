package one.absent.hackaton.selling;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

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
    static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 1, 2, 3};
    @Autowired WebApplicationContext context;
    @Autowired PhotoRepository photos;
    @Autowired JsonMapper json;
    MockMvc mvc;

    @BeforeEach void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    static MockMultipartFile photo(String type) {
        return new MockMultipartFile("photos", "item", type, PNG);
    }

    @Test void uploadStoresEachPhotoOnceForTheSellerAndServesIt() throws Exception {
        long before = photos.count();
        String body = mvc.perform(multipart("/api/photos").file(photo("image/png")).file(photo("image/png"))
                        .with(jwt().jwt(j -> j.subject("seller"))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertThat(photos.count()).isEqualTo(before + 2);
        long id = json.readTree(body).get(0).asLong();
        assertThat(photos.findById(id).orElseThrow().getSellerId()).isEqualTo("seller");

        mvc.perform(get("/api/photos/" + id))
                .andExpect(status().isOk())
                .andExpect(content().contentType("image/png"))
                .andExpect(content().bytes(PNG))
                .andExpect(header().string("Cache-Control", "max-age=86400, public"));
    }

    @Test void wrongTypeIsRejected() throws Exception {
        mvc.perform(multipart("/api/photos").file(photo("application/pdf"))
                        .with(jwt().jwt(j -> j.subject("seller"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Photos must be JPEG, PNG, GIF or WebP images."));
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
