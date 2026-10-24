package one.absent.hackaton.selling;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.function.Consumer;

import javax.imageio.ImageIO;

import one.absent.hackaton.ai.AiClient;
import one.absent.hackaton.listing.ListingRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class DraftControllerTest {
    static final byte[] PNG = image("png");
    @Autowired WebApplicationContext context;
    @Autowired PhotoRepository photos;
    @Autowired ListingRepository listings;
    @Autowired PhotoCleanup cleanup;
    @MockitoBean AiClient ai;
    MockMvc mvc;

    @BeforeEach void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
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

    long photoOf(String seller) {
        var photo = new Photo();
        photo.setContentType("image/png");
        photo.setData(PNG);
        photo.setSellerId(seller);
        photo.setCreatedAt(Instant.now());
        return photos.save(photo).getId();
    }

    void aiAnswers(String... lines) {
        doAnswer(inv -> {
            Consumer<String> onLine = inv.getArgument(3);
            for (String line : lines) {
                onLine.accept(line);
            }
            return null;
        }).when(ai).streamLines(anyString(), anyString(), anyList(), any());
    }

    String stream(String body) throws Exception {
        MvcResult started = mvc.perform(post("/api/listing-drafts/stream").with(jwt().jwt(j -> j.subject("seller")))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(request().asyncStarted())
                .andReturn();
        return mvc.perform(asyncDispatch(started))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Accel-Buffering", "no"))
                .andReturn().getResponse().getContentAsString();
    }

    @Test void streamsDetectionsGapsAndTheDraftAsEvents() throws Exception {
        long id = photoOf("seller");
        aiAnswers("""
                {"type":"detection","photo":1,"box":[0.1,0.1,0.2,0.2],"label":"Brand: Dell","fact":{"name":"Brand","value":"Dell","source":"LABEL"}}""",
                "{\"type\":\"gap\",\"name\":\"Size\",\"kind\":\"ASK\",\"prompt\":\"How big?\",\"options\":[\"24\\\"\",\"27\\\"\"]}",
                "garbage",
                "{\"type\":\"draft\",\"category\":\"Monitors\",\"title\":\"Dell U2719D\",\"description\":\"A monitor.\","
                        + "\"condition\":null,\"facts\":[{\"name\":\"Brand\",\"value\":\"Dell\",\"source\":\"LABEL\"}]}");

        String body = stream("{\"photoIds\":[%d],\"confirmedFacts\":[{\"name\":\"Size\",\"value\":\"27\\\"\"}]}"
                .formatted(id));

        assertThat(body.split("\n\n")).hasSize(3);
        assertThat(body).startsWith("data:{\"type\":\"DETECTION\"");
        assertThat(body).contains("\"type\":\"GAP\"", "\"type\":\"DRAFT\"", "\"photoIds\":[" + id + "]");
        ArgumentCaptor<String> text = ArgumentCaptor.forClass(String.class);
        verify(ai).streamLines(anyString(), text.capture(), anyList(), any());
        assertThat(text.getValue()).contains("Size: 27\"");
    }

    @Test void aiFailureBecomesAnErrorEvent() throws Exception {
        long id = photoOf("seller");
        aiAnswers("{\"type\":\"detection\",\"photo\":1,\"box\":[0,0,1,1],\"label\":\"Monitor\"}");

        String body = stream("{\"photoIds\":[%d],\"confirmedFacts\":[]}".formatted(id));

        assertThat(body).contains("\"type\":\"DETECTION\"", "\"type\":\"ERROR\"",
                "\"detail\":\"AI gave no usable answer, please try again.\"");
    }

    @Test void foreignOrPublishedPhotosAreRejectedBeforeStreaming() throws Exception {
        long foreign = photoOf("someone else");
        mvc.perform(post("/api/listing-drafts/stream").with(jwt().jwt(j -> j.subject("seller")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"photoIds\":[%d],\"confirmedFacts\":[]}".formatted(foreign)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Unknown photo."));
    }

    @Test void needsOneToFivePhotos() throws Exception {
        mvc.perform(post("/api/listing-drafts/stream").with(jwt().jwt(j -> j.subject("seller")))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"photoIds\":[],\"confirmedFacts\":[]}"))
                .andExpect(status().isBadRequest());
    }

    @Test void streamRequiresAuthentication() throws Exception {
        mvc.perform(post("/api/listing-drafts/stream").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"photoIds\":[1],\"confirmedFacts\":[]}"))
                .andExpect(status().isUnauthorized());
    }

    @Test void rewritesTitleAndDescriptionFromTheFacts() throws Exception {
        when(ai.ask(anyString(), anyString(), anyString(), anyList(), anyString(), eq(DraftController.DraftText.class)))
                .thenReturn(new DraftController.DraftText("Dell U2719D 27\" monitor", "My Dell U2719D monitor."));

        mvc.perform(post("/api/listing-drafts/text").with(jwt().jwt(j -> j.subject("seller")))
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"category":"Monitors","title":"Dell monitor","description":"My monitor.",
                                 "facts":[{"name":"Model","value":"U2719D","source":"SELLER"}]}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Dell U2719D 27\" monitor"))
                .andExpect(jsonPath("$.description").value("My Dell U2719D monitor."));
        ArgumentCaptor<String> text = ArgumentCaptor.forClass(String.class);
        verify(ai).ask(anyString(), anyString(), text.capture(), anyList(), anyString(), eq(DraftController.DraftText.class));
        assertThat(text.getValue()).contains("Model: U2719D (SELLER)", "Dell monitor");
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

    @Test void shortTitleCutsAtAWordBoundary() {
        String title = "Apple iMac 27 inch Retina 5K 2017 with Intel Core i5 and 16 GB RAM and 1 TB Fusion Drive";
        String cut = DraftController.shortTitle(title);
        assertThat(cut.length()).isLessThanOrEqualTo(60);
        assertThat(title).startsWith(cut + " ");
        assertThat(DraftController.shortTitle("Dell U2719D")).isEqualTo("Dell U2719D");
    }
}
