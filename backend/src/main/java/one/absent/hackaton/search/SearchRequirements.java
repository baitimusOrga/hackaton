package one.absent.hackaton.search;

import java.math.BigDecimal;
import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

/** What the buyer wants; {@code acceptUnknown}: also show items where a must-have detail is missing. */
public record SearchRequirements(@NotNull List<@Valid Requirement> mustHave,
                                 @NotNull List<@Valid Requirement> niceToHave,
                                 BigDecimal maxBudgetChf, String postcode, Integer maxDistanceKm,
                                 boolean acceptUnknown) {
}
