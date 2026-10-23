package one.absent.hackaton.search;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** {@code comparison}: how a numeric value is meant; null counts as EXACT. */
public record Requirement(@NotBlank @Size(max = 80) String attribute,
                          @NotBlank @Size(max = 200) String value,
                          @Schema(nullable = true) Comparison comparison) {

    public enum Comparison { AT_LEAST, EXACT, AT_MOST }
}
