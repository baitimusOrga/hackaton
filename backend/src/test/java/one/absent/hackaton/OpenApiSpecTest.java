package one.absent.hackaton;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@ActiveProfiles("test")
class OpenApiSpecTest {

    static final Path SPEC = Path.of("../frontend/openapi.json");

    @Autowired
    WebApplicationContext context;

    @Test
    void writeSpec() throws Exception {
        String spec = MockMvcBuilders.webAppContextSetup(context).build()
                .perform(get("/api/openapi.json"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        Files.writeString(SPEC, spec.strip() + "\n");
    }
}
