package one.absent.hackaton.listing;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.Set;

import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class CategoryControllerTest {
    final MockMvc mvc = MockMvcBuilders.standaloneSetup(new CategoryController()).build();

    @Test void everyCategoryHasKeyFactsAndAllAreAllowedNames() {
        assertThat(Categories.KEY_FACTS.keySet()).isEqualTo(Set.copyOf(Categories.ALL));
        Categories.KEY_FACTS.values().forEach(facts -> assertThat(Categories.FACT_NAMES).containsAll(facts));
        assertThat(Categories.FACT_NAMES).contains("Year", "Color");
    }

    @Test void listsCategoriesWithKeyFactsInOrder() throws Exception {
        mvc.perform(get("/api/categories"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Computers"))
                .andExpect(jsonPath("$[10].name").value("Bikes"))
                .andExpect(jsonPath("$[10].keyFacts[2]").value("Frame size"));
    }
}
