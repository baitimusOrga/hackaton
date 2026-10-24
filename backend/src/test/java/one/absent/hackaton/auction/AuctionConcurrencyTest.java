package one.absent.hackaton.auction;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

import one.absent.hackaton.listing.Condition;
import one.absent.hackaton.listing.Listing;
import one.absent.hackaton.listing.ListingRepository;
import one.absent.hackaton.listing.ListingStatus;
import one.absent.hackaton.listing.SaleMode;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.server.ResponseStatusException;

/** Stress: many bidders at once on one listing, with real transactions (no test rollback), so the row lock counts. */
@SpringBootTest
@ActiveProfiles("test")
class AuctionConcurrencyTest {
    static final int BIDDERS = 12;
    static final int ATTEMPTS = 25;

    @Autowired AuctionService auctions;
    @Autowired ListingRepository listings;
    @Autowired BidRepository bids;
    final List<Long> created = new ArrayList<>();

    @AfterEach void cleanUp() {
        for (long id : created) {
            bids.deleteAll(bids.findByListingIdOrderByIdAsc(id));
            listings.deleteById(id);
        }
    }

    Listing auction(Duration endsIn) {
        var listing = new Listing();
        listing.setTitle("Stress chair");
        listing.setDescription("Office chair");
        listing.setCategory("Office furniture");
        listing.setCondition(Condition.GOOD);
        listing.setPriceChf(new BigDecimal("40"));
        listing.setPostcode("8004");
        listing.setLocality("Zürich");
        listing.setCreatedAt(Instant.now());
        listing.setSellerId("seller");
        listing.setSaleMode(SaleMode.AUCTION);
        listing.setEndsAt(Instant.now().plus(endsIn));
        listings.saveAndFlush(listing);
        created.add(listing.getId());
        return listing;
    }

    static Jwt user(String subject) {
        return Jwt.withTokenValue("t").header("alg", "none").subject(subject).claim("name", subject).build();
    }

    /** Every bidder reads the state and bids a little over the minimum; a bid that lost the race gets a 400. */
    int bidConcurrently(long id, AtomicBoolean stop) throws Exception {
        AtomicInteger accepted = new AtomicInteger();
        ExecutorService pool = Executors.newFixedThreadPool(BIDDERS);
        try {
            List<Future<?>> runs = new ArrayList<>();
            for (int b = 0; b < BIDDERS; b++) {
                String bidder = "bidder-" + b;
                var random = new Random(b);
                runs.add(pool.submit(() -> {
                    for (int i = 0; i < ATTEMPTS && !stop.get(); i++) {
                        var state = auctions.get(id, bidder);
                        if (state.leading()) continue;
                        var max = state.minimumNextBidChf()
                                .add(state.incrementChf().multiply(BigDecimal.valueOf(random.nextInt(4))));
                        try {
                            auctions.placeBid(id, user(bidder), max);
                            accepted.incrementAndGet();
                        } catch (ResponseStatusException raced) {
                            assertThat(raced.getStatusCode().value()).isEqualTo(400);
                        }
                    }
                    return null;
                }));
            }
            for (Future<?> run : runs) {
                run.get();
            }
        } finally {
            pool.shutdown();
        }
        return accepted.get();
    }

    @Test void concurrentBidsLoseNothingAndStayConsistent() throws Exception {
        long id = auction(Duration.ofSeconds(30)).getId();
        int accepted = bidConcurrently(id, new AtomicBoolean());

        List<Bid> stored = bids.findByListingIdOrderByIdAsc(id);
        assertThat(accepted).isGreaterThan(BIDDERS);
        assertThat(stored).hasSize(accepted);
        // insert order and time order agree, so the replay cannot reorder accepted bids
        for (int i = 1; i < stored.size(); i++) {
            assertThat(stored.get(i).getCreatedAt()).isAfterOrEqualTo(stored.get(i - 1).getCreatedAt());
        }
        var steps = AuctionService.history(new BigDecimal("40"), stored);
        Listing listing = listings.findById(id).orElseThrow();
        assertThat(listing.getCurrentBidChf()).isEqualByComparingTo(steps.getLast().amountChf());
        assertThat(listing.getBidCount()).isEqualTo(steps.size());
        for (int i = 1; i < steps.size(); i++) {
            assertThat(steps.get(i).amountChf()).isGreaterThanOrEqualTo(steps.get(i - 1).amountChf());
        }
        // the leader holds the highest maximum, and of equal maxima the earliest
        Bid best = stored.stream().reduce((a, b) -> b.getMaxChf().compareTo(a.getMaxChf()) > 0 ? b : a).orElseThrow();
        assertThat(steps.getLast().bidderId()).isEqualTo(best.getBidderId());
        // every bid came in the last 2 minutes, so the end is 2 minutes after the last one
        assertThat(listing.getEndsAt()).isEqualTo(stored.getLast().getCreatedAt().plus(AuctionService.EXTENSION));
    }

    @Test void closeJobNeverEndsAnAuctionABidJustExtended() throws Exception {
        long id = auction(Duration.ofMillis(300)).getId();
        auctions.placeBid(id, user("first"), new BigDecimal("40"));
        AtomicBoolean stop = new AtomicBoolean();
        Thread closer = new Thread(() -> {
            while (!stop.get()) auctions.closeDue();
        });
        closer.start();
        try {
            bidConcurrently(id, stop);
        } finally {
            stop.set(true);
            closer.join();
        }
        assertThat(listings.findById(id).orElseThrow().getStatus()).isEqualTo(ListingStatus.AVAILABLE);

        Listing listing = listings.findById(id).orElseThrow();
        listing.setEndsAt(Instant.now().minusSeconds(1));
        listings.saveAndFlush(listing);
        auctions.closeDue();
        assertThat(listings.findById(id).orElseThrow().getStatus()).isEqualTo(ListingStatus.SOLD);
    }
}
