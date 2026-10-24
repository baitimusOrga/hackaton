package one.absent.hackaton.selling;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import one.absent.hackaton.ai.AiClient;
import one.absent.hackaton.listing.Categories;
import one.absent.hackaton.selling.ListingDraft.DraftFact;
import one.absent.hackaton.selling.ListingDraft.FactSource;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Tops up a draft with technical data from the web, marked as {@code WEB} facts. */
@Tag(name = "Selling")
@RestController
public class WebFactsController {
    static final String WEB_SYSTEM = """
            You complete the technical data of a secondhand item for a listing.
            Rules:
            - Search the web for the manufacturer's spec page or a reliable datasheet of exactly this model.
            - Return only facts that are not in the known list, the category's key facts first. Fact names only
              from %s; values short and normalized.
            - Only specs that are fixed for this model. Skip anything that differs between configurations.
            - Every fact needs the URL of the page it came from. If nothing is reliable, return an empty list.
            - Answer with JSON only, no other text:
              {"facts":[{"name":"Resolution","value":"5120x2880","url":"https://..."}]}
            """.formatted(String.join(", ", Categories.FACT_NAMES));

    public record WebFactsRequest(@NotBlank @Size(max = 120) String title, @NotBlank @Size(max = 80) String category,
                                  @NotNull @Size(max = 30) List<@Valid @NotNull KnownFact> facts) {}

    public record KnownFact(@NotBlank @Size(max = 80) String name, @NotBlank @Size(max = 500) String value,
                            @NotNull FactSource source) {}

    record AiWebFacts(List<WebFact> facts) {}

    record WebFact(String name, String value, String url) {}

    private final AiClient ai;

    public WebFactsController(AiClient ai) {
        this.ai = ai;
    }

    // login is enforced by SecurityConfig (POST /api/listing-drafts/**)
    @PostMapping("/api/listing-drafts/web-facts")
    public List<DraftFact> completeFacts(@Valid @RequestBody WebFactsRequest request) {
        boolean modelConfirmed = request.facts().stream().anyMatch(f -> "Model".equals(f.name())
                && (f.source() == FactSource.LABEL || f.source() == FactSource.SELLER));
        if (!modelConfirmed) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Please confirm the model first, then we can look it up.");
        }
        StringBuilder text = new StringBuilder("Item: %s\nCategory: %s\nKey facts for %s: %s\nKnown facts (do not repeat):\n"
                .formatted(request.title(), request.category(), request.category(),
                        String.join(", ", Categories.KEY_FACTS.getOrDefault(request.category(), List.of()))));
        request.facts().forEach(f -> text.append("- %s: %s\n".formatted(f.name(), f.value())));

        AiWebFacts answer = ai.askWithWebSearch(WEB_SYSTEM, text.toString(), AiWebFacts.class);
        if (answer.facts() == null) {
            return List.of();
        }
        Set<String> known = new HashSet<>();
        request.facts().forEach(f -> known.add(f.name().toLowerCase()));
        return answer.facts().stream()
                .filter(f -> f.name() != null && Categories.FACT_NAMES.contains(f.name()))
                .filter(f -> f.value() != null && !f.value().isBlank() && f.value().strip().length() <= 80)
                .filter(f -> f.url() != null && (f.url().startsWith("https://") || f.url().startsWith("http://")))
                .filter(f -> known.add(f.name().toLowerCase())) // not known yet, first per name
                .limit(8)
                .map(f -> new DraftFact(f.name(), f.value().strip(), FactSource.WEB, f.url()))
                .toList();
    }
}
