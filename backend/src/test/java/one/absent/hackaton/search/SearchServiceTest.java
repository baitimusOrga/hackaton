package one.absent.hackaton.search;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;

import one.absent.hackaton.listing.Condition;
import one.absent.hackaton.listing.ListingDetail;
import org.junit.jupiter.api.Test;

class SearchServiceTest {

    static final ListingDetail IMAC = new ListingDetail(1, "iMac 27\" Retina 5K (2017)", new BigDecimal("450"),
            Condition.GOOD, "Computers", "8004", "Zürich", null, "Works well.",
            Map.of("Display", "27\" 5K", "RAM", "16 GB", "Year", "2017"), Instant.now(), null);

    @Test
    void mustHaveIsStatedDespiteDifferentUnits() {
        assertThat(SearchService.states(IMAC, new Requirement("Display", "27 Zoll"))).isTrue();
        assertThat(SearchService.states(IMAC, new Requirement("RAM", "16GB"))).isTrue();
        assertThat(SearchService.states(IMAC, new Requirement("Display", "5K"))).isTrue();
    }

    @Test
    void differentNumberOrMissingAttributeIsNotStated() {
        assertThat(SearchService.states(IMAC, new Requirement("RAM", "32 GB"))).isFalse();
        assertThat(SearchService.states(IMAC, new Requirement("Storage", "1 TB"))).isFalse();
    }
}
