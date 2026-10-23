package one.absent.hackaton.selling;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import one.absent.hackaton.listing.ListingRepository;
import one.absent.hackaton.photo.PhotoStorage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;
import software.amazon.awssdk.core.exception.SdkClientException;
import tools.jackson.databind.json.JsonMapper;

/** With real S3 credentials configured, new photos go to object storage and the row only keeps the key. */
@SpringBootTest
@ActiveProfiles("test")
@TestPropertySource(properties = "s3.access-key=test-key")
@Transactional
class PhotoS3StorageTest {
    private static final byte[] JPEG = DraftControllerTest.image("jpg");
    @Autowired WebApplicationContext context;
    @Autowired PhotoRepository photos;
    @Autowired JsonMapper json;
    @Autowired ListingRepository listings;
    @MockitoBean PhotoStorage storage;
    MockMvc mvc;

    @BeforeEach void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    @Test void uploadedPhotoIsStoredInS3AndServedFromThere() throws Exception {
        String body = mvc.perform(multipart("/api/photos")
                        .file(new MockMultipartFile("photos", "item.jpg", "image/jpeg", JPEG))
                        .with(jwt().jwt(j -> j.subject("seller"))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        long id = json.readTree(body).get(0).asLong();

        Photo photo = photos.findById(id).orElseThrow();
        assertThat(photo.getData()).isNull();
        assertThat(photo.getStorageKey()).startsWith("photos/");
        verify(storage).put(eq(photo.getStorageKey()), any(), eq("image/jpeg"));

        photo.setListingId(listings.findAll().getFirst().getId());
        when(storage.get(photo.getStorageKey())).thenReturn(new PhotoStorage.Photo(JPEG, "image/jpeg"));
        mvc.perform(get("/api/photos/" + id))
                .andExpect(status().isOk())
                .andExpect(content().contentType("image/jpeg"))
                .andExpect(content().bytes(JPEG));
    }

    @Test void s3FailureKeepsThePhotoInTheDatabase() throws Exception {
        doThrow(SdkClientException.create("bucket unreachable")).when(storage).put(anyString(), any(), anyString());
        String body = mvc.perform(multipart("/api/photos")
                        .file(new MockMultipartFile("photos", "item.jpg", "image/jpeg", JPEG))
                        .with(jwt().jwt(j -> j.subject("seller"))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        Photo photo = photos.findById(json.readTree(body).get(0).asLong()).orElseThrow();
        assertThat(photo.getStorageKey()).isNull();
        assertThat(photo.getData()).isNotEmpty();
    }
}
