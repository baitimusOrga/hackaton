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

import java.time.Instant;
import java.util.List;

import one.absent.hackaton.ai.AiClient;
import one.absent.hackaton.selling.IdentityController.Candidate;
import one.absent.hackaton.selling.IdentityController.IdentityCheck;
import one.absent.hackaton.selling.IdentityController.Verdict;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class IdentityControllerTest {
    private static final String URL = "/api/listing-drafts/identity";
    @Autowired WebApplicationContext context;
    @Autowired PhotoRepository photos;
    @MockitoBean AiClient ai;
    MockMvc mvc;

    @BeforeEach void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    long photoOf(String seller) {
        var photo = new Photo();
        photo.setContentType("image/png");
        photo.setData(DraftControllerTest.PNG);
        photo.setSellerId(seller);
        photo.setCreatedAt(Instant.now());
        return photos.save(photo).getId();
    }

    String body(long photo) {
        return """
                {"photoIds":[%d],"category":"Bikes","brand":"Norco","model":null,"language":"de"}""".formatted(photo);
    }

    @Test void aDoubtfulBrandComesWithUpToThreeSourcedCandidates() throws Exception {
        when(ai.askWithWebSearch(anyString(), anyString(), anyList(), eq(IdentityCheck.class)))
                .thenReturn(new IdentityCheck(Verdict.DOUBTFUL, "Das Logo passt eher zu Naloo.", List.of(
                        new Candidate("Naloo", "Bonfire", "Logo und Kinder-Fully passen.", "https://naloo.example/bikes"),
                        new Candidate("Norco", " ", "Ähnliche Schrift.", "https://norco.example"),
                        new Candidate("Fake", null, "Keine Quelle.", null),
                        new Candidate(" ", null, "Leer.", "https://x.example"))));

        mvc.perform(post(URL).with(jwt().jwt(j -> j.subject("seller")))
                        .contentType(MediaType.APPLICATION_JSON).content(body(photoOf("seller"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.verdict").value("DOUBTFUL"))
                .andExpect(jsonPath("$.note").value("Das Logo passt eher zu Naloo."))
                .andExpect(jsonPath("$.candidates.length()").value(2))
                .andExpect(jsonPath("$.candidates[0].brand").value("Naloo"))
                .andExpect(jsonPath("$.candidates[0].model").value("Bonfire"))
                .andExpect(jsonPath("$.candidates[1].model").doesNotExist());

        ArgumentCaptor<String> text = ArgumentCaptor.forClass(String.class);
        verify(ai).askWithWebSearch(anyString(), text.capture(), anyList(), eq(IdentityCheck.class));
        assertThat(text.getValue()).contains("brand Norco", "Bikes");
    }

    @Test void anAnswerWithoutVerdictIsUnknown() throws Exception {
        when(ai.askWithWebSearch(anyString(), anyString(), anyList(), eq(IdentityCheck.class)))
                .thenReturn(new IdentityCheck(null, null, null));

        mvc.perform(post(URL).with(jwt().jwt(j -> j.subject("seller")))
                        .contentType(MediaType.APPLICATION_JSON).content(body(photoOf("seller"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.verdict").value("UNKNOWN"))
                .andExpect(jsonPath("$.candidates.length()").value(0));
    }

    @Test void onlyTheSellersOwnPhotosAndOnlyLoggedIn() throws Exception {
        long foreign = photoOf("someone else");
        mvc.perform(post(URL).with(jwt().jwt(j -> j.subject("seller")))
                        .contentType(MediaType.APPLICATION_JSON).content(body(foreign)))
                .andExpect(status().isBadRequest());
        mvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content(body(foreign)))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(ai);
    }
}
