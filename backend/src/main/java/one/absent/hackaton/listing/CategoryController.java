package one.absent.hackaton.listing;

import java.util.List;

import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Listings")
@RestController
public class CategoryController {

    public record CategoryInfo(String name, List<String> keyFacts) {}

    @GetMapping("/api/categories")
    public List<CategoryInfo> categories() {
        return Categories.ALL.stream().map(c -> new CategoryInfo(c, Categories.KEY_FACTS.get(c))).toList();
    }
}
