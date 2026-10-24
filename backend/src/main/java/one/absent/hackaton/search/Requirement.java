package one.absent.hackaton.search;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * {@code comparison}: how a numeric value is meant; null counts as EXACT. {@code phrase}: the words of the buyer's
 * text the requirement came from, null when set by hand.
 */
public record Requirement(@NotBlank @Size(max = 80) String attribute,
                          @NotBlank @Size(max = 200) String value,
                          @Schema(nullable = true) Comparison comparison,
                          @Schema(nullable = true) @Size(max = 80) String phrase) {

    public Requirement(String attribute, String value, Comparison comparison) {
        this(attribute, value, comparison, null);
    }

    public enum Comparison { AT_LEAST, EXACT, AT_MOST }
}
