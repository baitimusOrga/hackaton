package one.absent.hackaton.clearance;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.List;

import one.absent.hackaton.clearance.ClearanceDtos.RouteOption;
import one.absent.hackaton.listing.Condition;
import org.junit.jupiter.api.Test;

class ClearanceRoutesTest {
    private static final List<RouteOption> TEN_THOUSAND = ClearanceService.routes(new BigDecimal("10000"), 5);

    @Test void routesForTenThousand() {
        assertThat(TEN_THOUSAND).extracting(RouteOption::route)
                .containsExactly(Route.SELF_SERVICE, Route.MANAGED, Route.DIRECT_PURCHASE);
        assertThat(TEN_THOUSAND).extracting(o -> o.netChf().intValue()).containsExactly(7000, 7225, 4500);
        assertThat(TEN_THOUSAND.get(1).serviceFeeChf()).isEqualByComparingTo("1275");
        assertThat(TEN_THOUSAND).extracting(RouteOption::certain).containsExactly(false, false, true);
    }

    @Test void recommendsDirectPurchaseWhenDeadlineIsClose() {
        assertThat(ClearanceService.recommend(13, TEN_THOUSAND)).isEqualTo(Route.DIRECT_PURCHASE);
    }

    @Test void recommendsManagedOtherwise() {
        assertThat(ClearanceService.recommend(14, TEN_THOUSAND)).isEqualTo(Route.MANAGED);
    }

    @Test void unitPriceUsesCategoryFallbackAndConditionFactor() {
        assertThat(ClearanceService.unitPrice(null, "Monitors", Condition.GOOD)).isEqualByComparingTo("90");
        assertThat(ClearanceService.unitPrice(null, "Monitors", Condition.USED)).isEqualByComparingTo("72");
        assertThat(ClearanceService.unitPrice(null, "Unknown", Condition.DEFECTIVE)).isEqualByComparingTo("10");
        assertThat(ClearanceService.unitPrice(new BigDecimal("120"), "Monitors", Condition.LIKE_NEW))
                .isEqualByComparingTo("120");
        assertThat(ClearanceService.unitPrice(new BigDecimal("2"), "Monitors", Condition.DEFECTIVE))
                .isEqualByComparingTo("1");
    }
}
