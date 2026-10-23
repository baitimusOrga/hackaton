package one.absent.hackaton.search;

import java.math.BigDecimal;
import java.util.List;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import one.absent.hackaton.listing.Condition;
import one.absent.hackaton.listing.ListingSummary;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Public: the buying assistant turns a free-text wish into requirements and matching listings. */
@Tag(name = "Search")
@RestController
@RequestMapping("/api/searches")
public class SearchController {

    // shortcut: sample data, replaced by the AI issues (HAC-23 requirements, HAC-24 matching).
    // Ids 9001/9002 are fictional so they never point at a real listing (new listings start at id 4).
    private static final SearchRequirements SAMPLE_REQUIREMENTS = new SearchRequirements(
            List.of(new Requirement("Model", "iMac 27\""), new Requirement("Display", "5K"),
                    new Requirement("Year", "2017"), new Requirement("Condition", "working")),
            List.of(new Requirement("Accessories", "keyboard and mouse")),
            new BigDecimal("600"), "8004", 30, true);

    private static final SearchResults SAMPLE_RESULTS = new SearchResults(
            List.of(new SearchMatch(new ListingSummary(1, "iMac 27\" Retina 5K (2017)", new BigDecimal("450.00"),
                    Condition.GOOD, "Computers", "8004", "Zürich", null),
                    "Model, 5K display and year are stated in the listing; within budget.", List.of(), List.of())),
            List.of(new SearchMatch(new ListingSummary(9001, "Apple iMac 27 inch", new BigDecimal("390.00"),
                    Condition.USED, "Computers", "8400", "Winterthur", null),
                    "Looks like the right model, but the listing doesn't say which display or year.",
                    List.of("Is it the Retina 5K display?", "Which year is it from?"), List.of())),
            List.of(new SearchMatch(new ListingSummary(9002, "iMac 27\" Retina 5K (2019)", new BigDecimal("720.00"),
                    Condition.LIKE_NEW, "Computers", "6300", "Zug", null),
                    "Newer model in very good condition, but above your budget.",
                    List.of(), List.of("CHF 720 instead of at most CHF 600", "2019 instead of 2017"))));

    @PostMapping
    public SearchRequirements create(@Valid @RequestBody SearchRequest request) {
        return SAMPLE_REQUIREMENTS;
    }

    @PostMapping("/matches")
    public SearchResults matches(@Valid @RequestBody SearchRequirements requirements) {
        return SAMPLE_RESULTS;
    }
}
