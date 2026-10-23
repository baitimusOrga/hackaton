package one.absent.hackaton.search;

import java.math.BigDecimal;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

/**
 * What the buyer wants; {@code keywords}: lowercase search terms incl. synonyms;
 * {@code acceptUnknown}: also show items where a must-have detail is missing.
 */
public record SearchRequirements(@NotNull List<@Valid Requirement> mustHave,
                                 @NotNull List<@Valid Requirement> niceToHave,
                                 @Schema(nullable = true) String category,
                                 @NotNull List<String> keywords,
                                 BigDecimal maxBudgetChf, String postcode, Integer maxDistanceKm,
                                 boolean acceptUnknown) {
}
