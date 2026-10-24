package one.absent.hackaton.auction;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import one.absent.hackaton.auction.AuctionService.Step;
import org.junit.jupiter.api.Test;

class AuctionServiceTest {
    static final BigDecimal START = new BigDecimal("100");
    static final Instant T0 = Instant.parse("2026-10-24T10:00:00Z");
    int second;

    Bid bid(String bidder, int max) {
        return new Bid(1L, bidder, bidder, BigDecimal.valueOf(max), T0.plusSeconds(second++));
    }

    static List<Integer> prices(List<Step> steps) {
        return steps.stream().map(s -> s.amountChf().intValue()).toList();
    }

    @Test void firstBidOpensAtStartPrice() {
        assertThat(prices(AuctionService.history(START, List.of(bid("a", 300))))).containsExactly(100);
    }

    @Test void higherMaximumPaysOneIncrementOverLoser() {
        var steps = AuctionService.history(START, List.of(bid("a", 200), bid("b", 300)));
        assertThat(prices(steps)).containsExactly(100, 205);
        assertThat(steps.getLast().bidderId()).isEqualTo("b");
    }

    @Test void lowerMaximumRaisesLeaderAutomatically() {
        var steps = AuctionService.history(START, List.of(bid("a", 300), bid("b", 200)));
        assertThat(prices(steps)).containsExactly(100, 200, 205);
        assertThat(steps.getLast().bidderId()).isEqualTo("a");
        assertThat(steps.getLast().automatic()).isTrue();
    }

    @Test void equalMaximumKeepsEarlierLeader() {
        var steps = AuctionService.history(START, List.of(bid("a", 300), bid("b", 300)));
        assertThat(prices(steps)).containsExactly(100, 300, 300);
        assertThat(steps.getLast().bidderId()).isEqualTo("a");
    }

    @Test void leaderRaisingOwnMaximumKeepsPrice() {
        var steps = AuctionService.history(START, List.of(bid("a", 200), bid("b", 150), bid("a", 400)));
        assertThat(prices(steps)).containsExactly(100, 150, 155);
        // the raised maximum still counts: b now needs more than 400
        steps = AuctionService.history(START, List.of(bid("a", 200), bid("a", 400), bid("b", 300)));
        assertThat(prices(steps)).containsExactly(100, 300, 305);
        assertThat(steps.getLast().bidderId()).isEqualTo("a");
    }

    @Test void maximumCapsThePrice() {
        var steps = AuctionService.history(START, List.of(bid("a", 100), bid("b", 103)));
        assertThat(prices(steps)).containsExactly(100, 103);
    }

    @Test void incrementsFollowTheTable() {
        assertThat(List.of(49, 50, 499, 500, 4999, 5000).stream()
                .map(p -> AuctionService.increment(BigDecimal.valueOf(p)).intValue()))
                .containsExactly(1, 5, 5, 10, 10, 50);
    }

    @Test void acceptanceScenario() {
        var steps = AuctionService.history(START, List.of(bid("a", 300), bid("b", 200), bid("b", 300), bid("b", 310)));
        assertThat(steps.getLast().amountChf().intValue()).isEqualTo(305);
        assertThat(steps.getLast().bidderId()).isEqualTo("b");
    }

    @Test void biddersAreAnonymised() {
        assertThat(AuctionService.anonymous("Maria")).isEqualTo("m···a");
        assertThat(AuctionService.anonymous("X")).isEqualTo("?···?");
    }
}
