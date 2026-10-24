package one.absent.hackaton.bookmark;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class BookmarkControllerTest {
    @Autowired WebApplicationContext context;
    MockMvc mvc;

    @BeforeEach void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    @Test void bookmarksToggleAndStayWithTheirOwner() throws Exception {
        var alice = jwt().jwt(j -> j.subject("alice"));
        var bob = jwt().jwt(j -> j.subject("bob"));
        mvc.perform(put("/api/listings/1001/bookmark").with(alice)).andExpect(status().isNoContent());
        mvc.perform(put("/api/listings/1001/bookmark").with(alice)).andExpect(status().isNoContent());
        mvc.perform(get("/api/bookmarks").with(alice))
                .andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].id").value(1001));
        mvc.perform(get("/api/bookmarks").with(bob)).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(delete("/api/listings/1001/bookmark").with(bob)).andExpect(status().isNoContent());
        mvc.perform(get("/api/bookmarks").with(alice)).andExpect(jsonPath("$.length()").value(1));
        mvc.perform(delete("/api/listings/1001/bookmark").with(alice)).andExpect(status().isNoContent());
        mvc.perform(get("/api/bookmarks").with(alice)).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(put("/api/listings/999999/bookmark").with(alice)).andExpect(status().isNotFound());
        mvc.perform(get("/api/bookmarks")).andExpect(status().isUnauthorized());
        mvc.perform(put("/api/listings/1001/bookmark")).andExpect(status().isUnauthorized());
    }
}
