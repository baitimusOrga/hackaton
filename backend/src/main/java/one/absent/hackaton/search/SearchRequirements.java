package one.absent.hackaton.search;

import java.math.BigDecimal;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * What the buyer wants; {@code keywords}: lowercase search terms incl. synonyms;
 * {@code acceptUnknown}: also show items where a must-have detail is missing.
 */
public record SearchRequirements(@NotNull @Size(max = 20) List<@Valid Requirement> mustHave,
                                 @NotNull @Size(max = 20) List<@Valid Requirement> niceToHave,
                                 @Schema(nullable = true) @Size(max = 80) String category,
                                 @NotNull @Size(max = 10) List<@Size(max = 80) String> keywords,
                                 @DecimalMin("0") @DecimalMax("1000000") BigDecimal maxBudgetChf,
                                 @Pattern(regexp = "[0-9]{0,4}") String postcode, @Min(0) @Max(500) Integer maxDistanceKm,
                                 boolean acceptUnknown) {
}
