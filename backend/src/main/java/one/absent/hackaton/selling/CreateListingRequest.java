package one.absent.hackaton.selling;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import jakarta.validation.constraints.*;
import one.absent.hackaton.listing.Condition;

public record CreateListingRequest(
        @NotBlank @Size(max = 120) String title,
        @NotBlank @Size(max = 4000) String description,
        @NotBlank @Size(max = 80) String category,
        @NotNull Condition condition,
        @NotNull @DecimalMin(value = "0", inclusive = false) @Digits(integer = 10, fraction = 2) BigDecimal priceChf,
        @NotNull @Pattern(regexp = "[0-9]{4}") String postcode,
        @NotBlank @Size(max = 120) String locality,
        @NotNull @Size(max = 30) Map<@NotBlank @Size(max = 80) String, @NotBlank @Size(max = 500) String> attributes,
        @NotNull @Size(max = 5) List<@NotNull Long> photoIds) {}
