package one.absent.hackaton.clearance;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.*;
import one.absent.hackaton.listing.Condition;

/** Request and response bodies of the clearance API. */
public final class ClearanceDtos {
    private ClearanceDtos() {}

    public record CreateProjectRequest(@NotBlank @Size(max = 120) String companyName,
                                       @NotNull @Pattern(regexp = "[0-9]{4}") String postcode,
                                       @NotBlank @Size(max = 120) String locality,
                                       @NotNull @FutureOrPresent LocalDate deadline) {}

    public record UpdateItemRequest(@NotBlank @Size(max = 120) String name,
                                    @NotBlank @Size(max = 80) String category,
                                    @Min(1) @Max(10000) int quantity, boolean quantityConfirmed,
                                    @NotNull Condition condition, @Size(max = 1000) String notes,
                                    @Schema(nullable = true, description = "Price per piece the company sets; "
                                            + "null keeps the estimate unconfirmed")
                                    @DecimalMin(value = "0", inclusive = false) @Digits(integer = 10, fraction = 2)
                                    BigDecimal unitPriceChf) {}

    public record ChooseRouteRequest(@NotNull Route route) {}

    public record PublishRequest(@NotEmpty @Size(max = 100) List<@NotNull Long> itemIds) {}

    public enum ItemStatus { DRAFT, LISTED, SOLD }

    public record ProjectSummary(long id, String companyName, String locality, LocalDate deadline,
                                 @Schema(nullable = true) Route route, int itemLines) {}

    public record ProjectDetail(long id, String companyName, String postcode, String locality, LocalDate deadline,
                                long daysLeft, @Schema(nullable = true) Route route, List<ItemView> items,
                                Totals totals, List<RouteOption> routes, Route recommendedRoute,
                                String recommendationReason) {}

    public record ItemView(long id, String name, String category, int quantity, boolean quantityConfirmed,
                           Condition condition, @Schema(nullable = true) String notes,
                           BigDecimal estimatedUnitChf,
                           @Schema(description = "Price per piece used at publishing: the company's price, "
                                   + "else the estimate") BigDecimal unitPriceChf,
                           @Schema(description = "Whether the company set the unit price itself")
                           boolean priceConfirmed,
                           BigDecimal estimatedTotalChf, ItemStatus status,
                           @Schema(nullable = true) Long listingId) {}

    public record Totals(int itemLines, int units, BigDecimal estimatedResaleChf, int draft, int listed, int sold) {}

    public record RouteOption(Route route, BigDecimal netChf, BigDecimal serviceFeeChf, boolean certain,
                              String timeframe, String yourWork) {}
}
