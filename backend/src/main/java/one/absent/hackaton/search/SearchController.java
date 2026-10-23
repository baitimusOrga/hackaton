package one.absent.hackaton.search;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Public: the buying assistant turns a free-text wish into requirements and matching listings. */
@Tag(name = "Search")
@RestController
@RequestMapping("/api/searches")
@RequiredArgsConstructor
public class SearchController {

    private final SearchService search;

    @PostMapping
    public SearchRequirements create(@Valid @RequestBody SearchRequest request) {
        return search.requirements(request.text());
    }

    @PostMapping("/matches")
    public SearchResults matches(@Valid @RequestBody SearchRequirements requirements) {
        return search.matches(requirements);
    }
}
