package one.absent.hackaton.savedsearch;

import java.time.Instant;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import one.absent.hackaton.search.SearchRequirements;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.json.JsonMapper;

/** A signed-in buyer's own saved searches. */
@Tag(name = "SavedSearches")
@RestController
@RequestMapping("/api/saved-searches")
@RequiredArgsConstructor
public class SavedSearchController {
    private final SavedSearchRepository searches;
    private final JsonMapper json;

    /** {@code text}: the sentence the search was read from, if any. */
    public record SaveSearchRequest(@NotBlank @Size(max = 120) String name,
                                    @Schema(nullable = true) @Size(max = 500) String text,
                                    @NotNull @Valid SearchRequirements requirements) {
    }

    public record SavedSearchResponse(Long id, String name, @Schema(nullable = true) String text,
                                      SearchRequirements requirements, Instant createdAt) {
    }

    @GetMapping
    public List<SavedSearchResponse> listMine(@AuthenticationPrincipal Jwt user) {
        return searches.findByOwnerIdOrderByCreatedAtDesc(user.getSubject()).stream().map(this::toResponse).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SavedSearchResponse save(@Valid @RequestBody SaveSearchRequest request,
                                      @AuthenticationPrincipal Jwt user) {
        var saved = new SavedSearch();
        saved.setOwnerId(user.getSubject());
        saved.setName(request.name().trim());
        saved.setQueryText(request.text());
        saved.setRequirements(json.writeValueAsString(request.requirements()));
        saved.setCreatedAt(Instant.now());
        return toResponse(searches.save(saved));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id, @AuthenticationPrincipal Jwt user) {
        searches.delete(searches.findByIdAndOwnerId(id, user.getSubject())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Saved search not found")));
    }

    private SavedSearchResponse toResponse(SavedSearch s) {
        return new SavedSearchResponse(s.getId(), s.getName(), s.getQueryText(),
                json.readValue(s.getRequirements(), SearchRequirements.class), s.getCreatedAt());
    }
}
