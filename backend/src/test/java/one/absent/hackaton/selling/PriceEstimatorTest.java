package one.absent.hackaton.selling;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.IntStream;

import one.absent.hackaton.listing.Listing;
import one.absent.hackaton.listing.ListingRepository;
import one.absent.hackaton.selling.ListingDraft.PriceConfidence;
import org.junit.jupiter.api.Test;

class PriceEstimatorTest {

    private static Listing listing(long id, String category, String title, int price) {
        var listing = new Listing();
        listing.setId(id);
        listing.setCategory(category);
        listing.setTitle(title);
        listing.setPriceChf(BigDecimal.valueOf(price));
        return listing;
    }

    private static PriceEstimator estimator(List<Listing> all) {
        ListingRepository repository = mock(ListingRepository.class);
        when(repository.findAll()).thenReturn(all);
        return new PriceEstimator(repository);
    }

    @Test void noComparablesLeavesThePriceToTheSeller() {
        var estimate = estimator(List.of(listing(1, "Bikes", "Dell monitor", 100), listing(2, "Monitors", "Herman chair", 50)))
                .estimate("Monitors", "Dell U2719D");
        assertThat(estimate.midChf()).isNull();
        assertThat(estimate.provisional()).isTrue();
        assertThat(estimate.confidence()).isEqualTo(PriceConfidence.LOW);
        assertThat(estimate.explanation()).isEqualTo("No comparable listings yet, set your own price.");
    }

    @Test void twoComparablesAreProvisional() {
        var estimate = estimator(List.of(listing(1, "Monitors", "DELL monitor", 100), listing(2, "monitors", "Dell P2419H", 200),
                listing(3, "Monitors", "LG UltraFine", 900)))
                .estimate("Monitors", "Dell U2719D");
        assertThat(estimate.lowChf()).isEqualByComparingTo("125");
        assertThat(estimate.midChf()).isEqualByComparingTo("150");
        assertThat(estimate.highChf()).isEqualByComparingTo("175");
        assertThat(estimate.provisional()).isTrue();
        assertThat(estimate.confidence()).isEqualTo(PriceConfidence.LOW);
        assertThat(estimate.evidence()).hasSize(2);
        assertThat(estimate.explanation()).contains("provisional");
    }

    @Test void sixComparablesGiveAMediumConfidenceRange() {
        List<Listing> all = new ArrayList<>(IntStream.rangeClosed(1, 6)
                .mapToObj(i -> listing(i, "Monitors", "Dell monitor " + i, i * 100)).toList());
        var estimate = estimator(all).estimate("Monitors", "Dell U2719D");
        assertThat(estimate.lowChf()).isEqualByComparingTo("225");
        assertThat(estimate.midChf()).isEqualByComparingTo("350");
        assertThat(estimate.highChf()).isEqualByComparingTo("475");
        assertThat(estimate.provisional()).isFalse();
        assertThat(estimate.confidence()).isEqualTo(PriceConfidence.MEDIUM);
        assertThat(estimate.evidence()).hasSize(5);
        assertThat(estimate.explanation()).doesNotContain("provisional");
    }
}
