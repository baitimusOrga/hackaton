package one.absent.hackaton.selling;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.stream.IntStream;

import one.absent.hackaton.listing.Condition;
import one.absent.hackaton.listing.Listing;
import one.absent.hackaton.listing.ListingRepository;
import one.absent.hackaton.listing.ListingStatus;
import one.absent.hackaton.selling.ListingDraft.DraftFact;
import one.absent.hackaton.selling.ListingDraft.FactSource;
import one.absent.hackaton.selling.ListingDraft.PriceConfidence;
import one.absent.hackaton.selling.ListingDraft.PriceEstimate;
import one.absent.hackaton.selling.ListingDraft.Similarity;
import org.junit.jupiter.api.Test;

class PriceEstimatorTest {

    private static final List<DraftFact> DELL = facts("Dell", "U2719D", FactSource.LABEL);

    private static List<DraftFact> facts(String brand, String model, FactSource source) {
        return List.of(new DraftFact("Brand", brand, source), new DraftFact("Model", model, source));
    }

    private static Listing listing(long id, String category, String title, int price, Condition condition,
                                   ListingStatus status, int daysOld, String brand, String model) {
        var listing = new Listing();
        listing.setId(id);
        listing.setCategory(category);
        listing.setTitle(title);
        listing.setPriceChf(BigDecimal.valueOf(price));
        listing.setCondition(condition);
        listing.setStatus(status);
        listing.setCreatedAt(Instant.now().minus(daysOld, ChronoUnit.DAYS));
        if (brand != null) listing.getAttributes().put("Brand", brand);
        if (model != null) listing.getAttributes().put("Model", model);
        return listing;
    }

    private static Listing dell(long id, int price, Condition condition, ListingStatus status) {
        return listing(id, "Monitors", "Dell U2719D monitor " + id, price, condition, status, 10 + (int) id, "Dell",
                "U2719D");
    }

    private static PriceEstimator estimator(List<Listing> all) {
        ListingRepository repository = mock(ListingRepository.class);
        when(repository.findAll()).thenReturn(all);
        return new PriceEstimator(repository);
    }

    private static PriceEstimate dellEstimate(List<Listing> all, Condition condition) {
        return estimator(all).estimate("Monitors", "Dell U2719D 27 inch", DELL, condition);
    }

    @Test void unidentifiedItemGetsNoEstimateFromUnrelatedListings() {
        var estimate = estimator(List.of(
                listing(1, "Monitors", "LG 27UL850 4K monitor", 220, Condition.GOOD, ListingStatus.AVAILABLE, 5, "LG", "27UL850"),
                listing(2, "Monitors", "Samsung 24 office monitor", 70, Condition.USED, ListingStatus.AVAILABLE, 5, "Samsung", null)))
                .estimate("Monitors", "Computer monitor", List.of(), null);
        assertThat(estimate.lowChf()).isNull();
        assertThat(estimate.midChf()).isNull();
        assertThat(estimate.highChf()).isNull();
        assertThat(estimate.confidence()).isEqualTo(PriceConfidence.LOW);
        assertThat(estimate.provisional()).isTrue();
        assertThat(estimate.evidence()).isEmpty();
        assertThat(estimate.explanation()).contains("brand and model");
    }

    @Test void titleLookAlikesAreAlwaysProvisionalAndLow() {
        var estimate = estimator(List.of(
                listing(1, "Monitors", "Dell U2719D 27 inch monitor", 150, Condition.GOOD, ListingStatus.AVAILABLE, 5, null, null),
                listing(2, "Monitors", "Dell U2719D 27 inch screen", 170, Condition.GOOD, ListingStatus.AVAILABLE, 6, null, null)))
                .estimate("Monitors", "Dell U2719D 27 inch monitor", List.of(), Condition.GOOD);
        assertThat(estimate.midChf()).isNotNull();
        assertThat(estimate.confidence()).isEqualTo(PriceConfidence.LOW);
        assertThat(estimate.provisional()).isTrue();
        assertThat(estimate.evidence()).allMatch(e -> e.similarity() == Similarity.SIMILAR_TITLE);
        assertThat(estimate.explanation()).contains("look-alikes only");
    }

    @Test void differentModelOfSameBrandIsNotEvidence() {
        var estimate = dellEstimate(List.of(
                listing(1, "Monitors", "Dell P2419H 24 inch monitor", 100, Condition.GOOD, ListingStatus.SOLD, 5, "Dell", "P2419H")),
                Condition.GOOD);
        assertThat(estimate.midChf()).isNull();
        assertThat(estimate.explanation()).startsWith("No estimate: no listing of this model");
    }

    @Test void otherBrandIsNeverEvidence() {
        var estimate = dellEstimate(List.of(
                listing(1, "Monitors", "HP U2719D 27 inch monitor", 100, Condition.GOOD, ListingStatus.SOLD, 5, "HP", "U2719D")),
                Condition.GOOD);
        assertThat(estimate.midChf()).isNull();
        assertThat(estimate.evidence()).isEmpty();
    }

    @Test void fiveSameModelSalesGiveHighConfidence() {
        var all = IntStream.rangeClosed(1, 5).mapToObj(i -> dell(i, 140 + i * 5, Condition.GOOD, ListingStatus.SOLD)).toList();
        var estimate = dellEstimate(all, Condition.GOOD);
        assertThat(estimate.confidence()).isEqualTo(PriceConfidence.HIGH);
        assertThat(estimate.provisional()).isFalse();
        assertThat(estimate.comparableCount()).isEqualTo(5);
        assertThat(estimate.soldCount()).isEqualTo(5);
        assertThat(estimate.midChf()).isEqualByComparingTo("155");
        assertThat(estimate.evidence()).hasSize(5);
        assertThat(estimate.evidence().getFirst().similarity()).isEqualTo(Similarity.SAME_MODEL);
        assertThat(estimate.evidence().getFirst().similarityPercent()).isEqualTo(100);
        assertThat(estimate.evidence().getFirst().sold()).isTrue();
        assertThat(estimate.explanation()).startsWith("Based on 5 completed sales of the same model in Monitors.");
    }

    @Test void completedSalesWinOverAskingPricesFromThree() {
        var all = List.of(dell(1, 150, Condition.GOOD, ListingStatus.SOLD), dell(2, 150, Condition.GOOD, ListingStatus.SOLD),
                dell(3, 150, Condition.GOOD, ListingStatus.SOLD), dell(4, 400, Condition.GOOD, ListingStatus.AVAILABLE));
        var estimate = dellEstimate(all, Condition.GOOD);
        assertThat(estimate.comparableCount()).isEqualTo(3);
        assertThat(estimate.highChf()).isEqualByComparingTo("150");
        assertThat(estimate.confidence()).isEqualTo(PriceConfidence.MEDIUM);
    }

    @Test void conditionAdjustsComparablePrices() {
        var all = List.of(dell(1, 115, Condition.LIKE_NEW, ListingStatus.SOLD));
        var estimate = dellEstimate(all, Condition.USED);
        assertThat(estimate.midChf()).isEqualByComparingTo("85");
        assertThat(estimate.condition()).isEqualTo(Condition.USED);
        assertThat(estimate.evidence().getFirst().adjustedPriceChf()).isEqualByComparingTo("85.00");
        assertThat(estimate.evidence().getFirst().priceChf()).isEqualByComparingTo("115");
    }

    @Test void wideSpreadLowersConfidence() {
        var all = List.of(dell(1, 100, Condition.GOOD, ListingStatus.SOLD), dell(2, 100, Condition.GOOD, ListingStatus.SOLD),
                dell(3, 100, Condition.GOOD, ListingStatus.SOLD), dell(4, 300, Condition.GOOD, ListingStatus.SOLD),
                dell(5, 300, Condition.GOOD, ListingStatus.SOLD));
        var estimate = dellEstimate(all, Condition.GOOD);
        assertThat(estimate.confidence()).isEqualTo(PriceConfidence.MEDIUM);
        assertThat(estimate.explanation()).contains("Prices vary widely");
    }

    @Test void suggestedModelCapsConfidenceAtMedium() {
        var all = IntStream.rangeClosed(1, 5).mapToObj(i -> dell(i, 150, Condition.GOOD, ListingStatus.SOLD)).toList();
        var estimate = estimator(all).estimate("Monitors", "Dell U2719D",
                facts("Dell", "U2719D", FactSource.SUGGESTION), Condition.GOOD);
        assertThat(estimate.confidence()).isEqualTo(PriceConfidence.MEDIUM);
        assertThat(estimate.explanation()).contains("suggestion from the photo");
    }

    @Test void unknownConditionIsAssumedGood() {
        var estimate = dellEstimate(List.of(dell(1, 100, Condition.GOOD, ListingStatus.SOLD)), null);
        assertThat(estimate.condition()).isEqualTo(Condition.GOOD);
        assertThat(estimate.explanation()).contains("condition Good (assumed)");
    }

    @Test void oldSignatureStillWorks() {
        var estimate = estimator(List.of(dell(1, 100, Condition.GOOD, ListingStatus.AVAILABLE)))
                .estimate("Monitors", "Computer monitor");
        assertThat(estimate.midChf()).isNull();
    }
}
