package one.absent.hackaton.listing;

import java.util.List;

import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Listings")
@RestController
public class CategoryController {

    public record CategoryInfo(String name, List<Categories.Field> fields) {}

    @GetMapping("/api/categories")
    public List<CategoryInfo> categories() {
        return Categories.ALL.stream().map(c -> new CategoryInfo(c, Categories.FIELDS.get(c))).toList();
    }
}
