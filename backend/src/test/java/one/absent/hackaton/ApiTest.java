package one.absent.hackaton;

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@ActiveProfiles("test")
class ApiTest {

    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 0, 0, 0, 0};

    @Autowired
    WebApplicationContext context;

    MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    private String register(String email) throws Exception {
        String body = mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"secret123\",\"displayName\":\"Ana\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.token");
    }

    @Test
    void registerLoginAndMe() throws Exception {
        String token = register("ana@example.com");
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("ana@example.com"));
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"ANA@example.com\",\"password\":\"secret123\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty());
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"ana@example.com\",\"password\":\"wrong-one\"}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"ana@example.com\",\"password\":\"secret123\",\"displayName\":\"x\"}"))
                .andExpect(status().isConflict());
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer not-a-token"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void createListingWithImageThenReadIt() throws Exception {
        String token = register("bo@example.com");
        String created = mvc.perform(multipart("/api/listings")
                        .file(new MockMultipartFile("image", "x.png", "image/png", PNG))
                        .param("title", "Lamp").param("description", "Bright").param("priceCents", "1500")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.ownerName").value("Ana"))
                .andReturn().getResponse().getContentAsString();
        Integer id = JsonPath.read(created, "$.id");

        mvc.perform(get("/api/listings")).andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].title").value("Lamp"))
                .andExpect(jsonPath("$.total").value(org.hamcrest.Matchers.greaterThanOrEqualTo(1)));
        mvc.perform(get("/api/listings/" + id)).andExpect(status().isOk())
                .andExpect(jsonPath("$.imageUrl").value("/api/listings/" + id + "/image"));
        mvc.perform(get("/api/listings/" + id + "/image")).andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_PNG));
        mvc.perform(get("/api/listings/999999")).andExpect(status().isNotFound());
    }

    @Test
    void rejectsAnonymousWritesAndNonImages() throws Exception {
        mvc.perform(multipart("/api/listings").param("title", "x").param("description", "y"))
                .andExpect(status().isUnauthorized());
        String token = register("cy@example.com");
        mvc.perform(multipart("/api/listings")
                        .file(new MockMultipartFile("image", "x.png", "image/png", "<script>".getBytes()))
                        .param("title", "x").param("description", "y")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isUnsupportedMediaType());
    }

    @Test
    void llmEndpointSaysWhenItIsNotConfigured() throws Exception {
        String token = register("di@example.com");
        mvc.perform(post("/api/ai/describe").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Lamp\"}").header("Authorization", "Bearer " + token))
                .andExpect(status().isServiceUnavailable());
        mvc.perform(get("/api/info")).andExpect(status().isOk()).andExpect(jsonPath("$.llm").value(false));
    }

    @Test
    void healthIsPublic() throws Exception {
        mvc.perform(get("/actuator/health")).andExpect(status().isOk());
    }
}
