package one.absent.hackaton.search;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** A follow-up on an earlier search; {@code current} may hold filters the buyer set by hand. */
public record RefineRequest(@NotBlank @Size(max = 500) String originalText,
                            @NotNull @Size(max = 5) List<@NotBlank @Size(max = 200) String> refinements,
                            @NotNull @Valid SearchRequirements current,
                            @NotBlank @Size(max = 200) String text,
                            @NotNull @Size(max = 5) List<@NotNull Long> topListingIds) {
}
