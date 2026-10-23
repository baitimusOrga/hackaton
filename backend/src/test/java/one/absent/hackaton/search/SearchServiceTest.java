package one.absent.hackaton.search;

import static one.absent.hackaton.search.Requirement.Comparison.AT_LEAST;
import static one.absent.hackaton.search.Requirement.Comparison.AT_MOST;
import static one.absent.hackaton.search.Requirement.Comparison.EXACT;
import static one.absent.hackaton.search.SearchService.Evidence.DIFFERENT;
import static one.absent.hackaton.search.SearchService.Evidence.MISSING;
import static one.absent.hackaton.search.SearchService.Evidence.STATED;
import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import one.absent.hackaton.listing.Condition;
import one.absent.hackaton.listing.ListingDetail;
import org.junit.jupiter.api.Test;

class SearchServiceTest {

    static final ListingDetail IMAC = new ListingDetail(1, "iMac 27\" Retina 5K (2017)", new BigDecimal("450"),
            Condition.GOOD, "Computers", "8004", "Zürich", null, "Works well.",
            Map.of("Display", "27\" 5K", "RAM", "16 GB", "Year", "2017"), Instant.now(), null, null, null);
    static final ListingDetail IMAC_2019 = new ListingDetail(2, "iMac 27\" Retina 5K (2019)", new BigDecimal("720"),
            Condition.LIKE_NEW, "Computers", "3007", "Bern", null, "Very good condition.",
            Map.of("Display", "27\" 5K", "Year", "2019"), Instant.now(), null, null, null);
    static final ListingDetail OLD_IMAC = new ListingDetail(3, "Apple iMac 27 inch", new BigDecimal("300"),
            Condition.USED, "Computers", "8001", "Zürich", null, "Older iMac.", Map.of(), Instant.now(), null, null, null);
    static final ListingDetail DEFECTIVE_PHONE = new ListingDetail(4, "Phone", new BigDecimal("50"),
            Condition.DEFECTIVE, "Phones", "8001", "Zürich", null, "Broken screen.", Map.of(), Instant.now(), null, null, null);

    static Requirement req(String attribute, String value) {
        return new Requirement(attribute, value, EXACT);
    }

    @Test
    void mustHaveIsStatedDespiteDifferentUnits() {
        assertThat(SearchService.check(IMAC, req("Display", "27 Zoll"))).isEqualTo(STATED);
        assertThat(SearchService.check(IMAC, req("RAM", "16GB"))).isEqualTo(STATED);
        assertThat(SearchService.check(IMAC, req("Display", "5K"))).isEqualTo(STATED);
    }

    @Test
    void differentValueIsDifferenceAbsentAttributeIsMissing() {
        assertThat(SearchService.check(IMAC_2019, req("Year", "2017"))).isEqualTo(DIFFERENT);
        assertThat(SearchService.check(IMAC, req("Storage", "1 TB"))).isEqualTo(MISSING);
    }

    @Test
    void atLeastAndAtMostCompareNumbers() {
        ListingDetail ram8 = withAttributes(IMAC, Map.of("RAM", "8 GB"));
        ListingDetail ram32 = withAttributes(IMAC, Map.of("RAM", "32 GB", "Storage", "1 TB"));
        Requirement ram16 = new Requirement("RAM", "16 GB", AT_LEAST);
        assertThat(SearchService.check(ram32, ram16)).isEqualTo(STATED);
        assertThat(SearchService.check(ram8, ram16)).isEqualTo(DIFFERENT);
        assertThat(SearchService.check(withAttributes(IMAC, Map.of()), ram16)).isEqualTo(MISSING);
        assertThat(SearchService.check(ram32, new Requirement("Storage", "512 GB", AT_LEAST))).isEqualTo(STATED);
        assertThat(SearchService.check(ram8, new Requirement("RAM", "16 GB", AT_MOST))).isEqualTo(STATED);
        assertThat(SearchService.check(ram32, req("RAM", "16 GB"))).isEqualTo(DIFFERENT);
    }

    @Test
    void workingMeansNotDefective() {
        assertThat(SearchService.check(IMAC, req("Condition", "working"))).isEqualTo(STATED);
        assertThat(SearchService.check(DEFECTIVE_PHONE, req("Condition", "working"))).isEqualTo(DIFFERENT);
        assertThat(SearchService.check(IMAC, req("Condition", "Like new"))).isEqualTo(DIFFERENT);
        assertThat(SearchService.check(withCondition(IMAC, Condition.NEW), req("Condition", "Like new")))
                .isEqualTo(STATED);
    }

    @Test
    void demoQueryLandsInThreeGroups() {
        SearchRequirements demo = demoQuery();
        SearchService.Ranked ranked = new SearchService.Ranked(List.of(), List.of(
                new SearchService.Item(1, "Fits.", List.of(), List.of()),
                new SearchService.Item(2, "Fits.", List.of(), List.of()),
                new SearchService.Item(3, "Fits.", List.of(), List.of())), List.of());

        SearchResults results = service().validate(demo, List.of(IMAC, IMAC_2019, OLD_IMAC), ranked);

        assertThat(results.confirmed()).extracting(m -> m.listing().id()).containsExactly(1L);
        assertThat(results.possible()).extracting(m -> m.listing().id()).containsExactly(3L);
        assertThat(results.possible().get(0).missingDetails()).containsExactly("Display: 27\" 5K", "Year: 2017");
        assertThat(results.alternatives()).extracting(m -> m.listing().id()).containsExactly(2L);
        assertThat(results.alternatives().get(0).differences()).containsExactly(
                "CHF 720 instead of at most CHF 600", "In Bern (3007), outside the 80xx area",
                "Year: 2019 instead of 2017");
        assertThat(results.compared()).isEqualTo(3);
    }

    @Test
    void perfectMatchLeftOutByAiIsStillConfirmed() {
        SearchResults results = service().validate(demoQuery(), List.of(IMAC),
                new SearchService.Ranked(List.of(), List.of(), List.of()));

        assertThat(results.confirmed()).extracting(m -> m.listing().id()).containsExactly(1L);
        assertThat(results.confirmed().get(0).reason()).isEqualTo("Listing states every must-have.");
    }

    @Test
    void aiDetailsDoNotLeakIntoCodeDecidedGroups() {
        SearchService.Ranked ranked = new SearchService.Ranked(List.of(
                new SearchService.Item(1, "Fits.", List.of("Does it have a keyboard?"),
                        List.of("Keyboard and mouse included, which the buyer did not ask for."))), List.of(
                new SearchService.Item(3, "Close.", List.of("No keyboard included."), List.of("Older model."))),
                List.of());

        SearchResults results = service().validate(demoQuery(), List.of(IMAC, OLD_IMAC), ranked);

        assertThat(results.confirmed().get(0).differences()).isEmpty();
        assertThat(results.confirmed().get(0).missingDetails()).isEmpty();
        assertThat(results.possible().get(0).missingDetails()).containsExactly("Display: 27\" 5K", "Year: 2017");
        assertThat(results.possible().get(0).differences()).isEmpty();
    }

    static SearchRequirements demoQuery() {
        return new SearchRequirements(List.of(req("Model", "iMac"), req("Display", "27\" 5K"), req("Year", "2017"),
                req("Condition", "working")), List.of(), "Computers", List.of("imac"), new BigDecimal("600"), "8001",
                null, true);
    }

    static SearchService service() {
        return new SearchService(null, null, null, "model", null);
    }

    static ListingDetail withAttributes(ListingDetail l, Map<String, String> attributes) {
        return new ListingDetail(l.id(), l.title(), l.priceChf(), l.condition(), l.category(), l.postcode(),
                l.locality(), l.imageUrl(), l.description(), attributes, l.createdAt(), null, null, null);
    }

    static ListingDetail withCondition(ListingDetail l, Condition condition) {
        return new ListingDetail(l.id(), l.title(), l.priceChf(), condition, l.category(), l.postcode(),
                l.locality(), l.imageUrl(), l.description(), l.attributes(), l.createdAt(), null, null, null);
    }
}
