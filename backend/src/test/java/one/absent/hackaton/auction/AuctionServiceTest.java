package one.absent.hackaton.auction;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

import one.absent.hackaton.auction.AuctionDtos.AuctionState;
import one.absent.hackaton.auction.AuctionService.Step;
import one.absent.hackaton.listing.Listing;
import one.absent.hackaton.listing.SaleMode;
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

    /**
     * Stress: thousands of random auctions, bids accepted with the service's own checks, compared after every bid
     * with a reference model: the price is the second-highest maximum plus its increment, capped at the highest;
     * on equal maxima the bidder who reached it first leads; the leader raising their own maximum keeps the price.
     */
    @Test void randomAuctionsMatchTheReferenceModel() {
        var random = new Random(42);
        int accepted = 0;
        for (int auction = 0; auction < 3000; auction++) {
            BigDecimal start = BigDecimal.valueOf(List.of(1, 45, 99, 480, 4990, 20000).get(random.nextInt(6)));
            var listing = new Listing();
            listing.setPriceChf(start);
            listing.setSaleMode(SaleMode.AUCTION);
            listing.setEndsAt(T0.plus(Duration.ofDays(1)));
            List<Bid> all = new ArrayList<>();
            Map<String, BigDecimal> maxOf = new HashMap<>();
            Map<String, Integer> reachedAt = new HashMap<>();
            BigDecimal lastPrice = start;
            for (int attempt = 0; attempt < 60; attempt++) {
                String bidder = "u" + random.nextInt(2 + random.nextInt(6));
                AuctionState before = AuctionService.state(listing, all, bidder, T0);
                BigDecimal amount = before.minimumNextBidChf()
                        .add(before.incrementChf().multiply(BigDecimal.valueOf(random.nextInt(40) - 5)))
                        .add(random.nextInt(4) == 0 ? new BigDecimal("0.35") : BigDecimal.ZERO);
                // the same two checks as placeBid
                if (before.leading() && amount.compareTo(before.myMaxChf()) <= 0
                        || amount.compareTo(before.minimumNextBidChf()) < 0) {
                    continue;
                }
                boolean ownRaise = before.leading();
                all.add(new Bid(1L, bidder, bidder, amount, T0.plusSeconds(attempt)));
                accepted++;
                if (maxOf.merge(bidder, amount, BigDecimal::max).equals(amount)) {
                    reachedAt.put(bidder, attempt);
                }

                List<Step> steps = AuctionService.history(start, all);
                String leader = maxOf.keySet().stream().min((a, b) -> {
                    int byMax = maxOf.get(b).compareTo(maxOf.get(a));
                    return byMax != 0 ? byMax : reachedAt.get(a) - reachedAt.get(b);
                }).orElseThrow();
                BigDecimal top = maxOf.get(leader);
                BigDecimal expected = ownRaise ? lastPrice : maxOf.entrySet().stream().filter(e -> !e.getKey().equals(leader))
                        .map(Map.Entry::getValue).max(BigDecimal::compareTo)
                        .map(second -> top.min(second.add(AuctionService.increment(second)))).orElse(start);
                BigDecimal price = steps.getLast().amountChf();
                String context = "auction " + auction + ", bids " + all.stream()
                        .map(b -> b.getBidderId() + ":" + b.getMaxChf()).toList();
                assertThat(price).as(context).isEqualByComparingTo(expected);
                assertThat(steps.getLast().bidderId()).as(context).isEqualTo(leader);
                assertThat(price).as(context).isGreaterThanOrEqualTo(lastPrice).isLessThanOrEqualTo(top);
                for (int i = 1; i < steps.size(); i++) {
                    assertThat(steps.get(i).amountChf()).as(context)
                            .isGreaterThanOrEqualTo(steps.get(i - 1).amountChf());
                }
                AuctionState after = AuctionService.state(listing, all, leader, T0);
                assertThat(after.leading()).isTrue();
                assertThat(after.bidCount()).isEqualTo(steps.size());
                assertThat(after.minimumNextBidChf()).isEqualByComparingTo(price.add(AuctionService.increment(price)));
                lastPrice = price;
            }
        }
        assertThat(accepted).isGreaterThan(50_000);
    }
}
