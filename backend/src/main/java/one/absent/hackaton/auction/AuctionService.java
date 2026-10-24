package one.absent.hackaton.auction;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

import one.absent.hackaton.auction.AuctionDtos.AuctionState;
import one.absent.hackaton.auction.AuctionDtos.BidView;
import one.absent.hackaton.listing.Listing;
import one.absent.hackaton.listing.ListingRepository;
import one.absent.hackaton.listing.ListingStatus;
import one.absent.hackaton.listing.SaleMode;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/** Proxy bidding: bids are private maxima, the price is one increment over the second-highest maximum. */
@Service
public class AuctionService {
    static final Duration EXTENSION = Duration.ofMinutes(2);

    private final ListingRepository listings;
    private final BidRepository bids;

    public AuctionService(ListingRepository listings, BidRepository bids) {
        this.listings = listings;
        this.bids = bids;
    }

    /** A visible price step; {@code automatic} when the leader's proxy answered a lower bid. */
    record Step(BigDecimal amountChf, String bidderId, String bidderName, Instant at, boolean automatic) {}

    @Transactional(readOnly = true)
    public AuctionState get(long listingId, String viewerId) {
        Listing listing = auction(listings.findById(listingId).orElse(null));
        return state(listing, bids.findByListingIdOrderByCreatedAtAscIdAsc(listingId), viewerId, Instant.now());
    }

    @Transactional
    public AuctionState placeBid(long listingId, Jwt bidder, BigDecimal maxChf) {
        Instant now = Instant.now();
        // the row lock serialises concurrent bids on the same listing
        Listing listing = auction(listings.findForUpdate(listingId).orElse(null));
        if (ended(listing, now)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This auction has ended.");
        }
        if (bidder.getSubject().equals(listing.getSellerId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot bid on your own listing.");
        }
        List<Bid> all = new ArrayList<>(bids.findByListingIdOrderByCreatedAtAscIdAsc(listingId));
        BigDecimal minimum = state(listing, all, bidder.getSubject(), now).minimumNextBidChf();
        if (maxChf.compareTo(minimum) < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Your maximum must be at least CHF " + minimum.stripTrailingZeros().toPlainString() + ".");
        }
        String name = bidder.getClaimAsString("name");
        all.add(bids.save(new Bid(listingId, bidder.getSubject(), name == null || name.isBlank() ? "?" : name,
                maxChf, now)));
        List<Step> steps = history(listing.getPriceChf(), all);
        listing.setCurrentBidChf(steps.getLast().amountChf());
        listing.setBidCount(steps.size());
        if (Duration.between(now, listing.getEndsAt()).compareTo(EXTENSION) < 0) {
            listing.setEndsAt(now.plus(EXTENSION));
        }
        return state(listing, all, bidder.getSubject(), now);
    }

    /** Ends every auction whose time is up: SOLD with bids, ENDED without. */
    @Transactional
    public void closeDue() {
        Instant now = Instant.now();
        for (Listing due : listings.findBySaleModeAndStatusAndEndsAtBefore(SaleMode.AUCTION, ListingStatus.AVAILABLE,
                now)) {
            // re-read under the lock so a bid committed meanwhile is not overwritten
            Listing listing = listings.findForUpdate(due.getId()).orElseThrow();
            if (ended(listing, now)) {
                listing.setStatus(listing.getBidCount() > 0 ? ListingStatus.SOLD : ListingStatus.ENDED);
            }
        }
    }

    private static Listing auction(Listing listing) {
        if (listing == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Listing not found.");
        }
        if (listing.getSaleMode() != SaleMode.AUCTION) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This listing is not an auction.");
        }
        return listing;
    }

    static boolean ended(Listing listing, Instant now) {
        return listing.getStatus() != ListingStatus.AVAILABLE || !now.isBefore(listing.getEndsAt());
    }

    static AuctionState state(Listing listing, List<Bid> all, String viewerId, Instant now) {
        List<Step> steps = history(listing.getPriceChf(), all);
        BigDecimal price = steps.isEmpty() ? null : steps.getLast().amountChf();
        BigDecimal increment = increment(price == null ? listing.getPriceChf() : price);
        BigDecimal minimum = price == null ? listing.getPriceChf() : price.add(increment);
        BigDecimal myMax = viewerId == null ? null : all.stream().filter(b -> viewerId.equals(b.getBidderId()))
                .map(Bid::getMaxChf).max(Comparator.naturalOrder()).orElse(null);
        boolean leading = viewerId != null && !steps.isEmpty() && viewerId.equals(steps.getLast().bidderId());
        List<BidView> views = steps.reversed().stream().map(s -> new BidView(s.amountChf(),
                anonymous(s.bidderName()), s.at(), s.automatic(), viewerId != null && viewerId.equals(s.bidderId())))
                .toList();
        return new AuctionState(listing.getEndsAt(), ended(listing, now), price, steps.size(), minimum, increment,
                myMax, leading, views);
    }

    /** Replays the maxima in bid order into the visible price history, oldest first. */
    static List<Step> history(BigDecimal startPrice, List<Bid> all) {
        List<Step> steps = new ArrayList<>();
        Bid leader = null;
        for (Bid bid : all) {
            if (leader == null) {
                steps.add(step(startPrice, bid, bid, false));
                leader = bid;
            } else if (bid.getBidderId().equals(leader.getBidderId())) {
                // raising your own maximum while leading does not move the price
                if (bid.getMaxChf().compareTo(leader.getMaxChf()) > 0) {
                    leader = bid;
                }
            } else if (bid.getMaxChf().compareTo(leader.getMaxChf()) > 0) {
                BigDecimal price = bid.getMaxChf().min(leader.getMaxChf().add(increment(leader.getMaxChf())));
                steps.add(step(price, bid, bid, false));
                leader = bid;
            } else {
                // the leader's proxy answers; on equal maxima the earlier one wins
                steps.add(step(bid.getMaxChf(), bid, bid, false));
                BigDecimal price = leader.getMaxChf().min(bid.getMaxChf().add(increment(bid.getMaxChf())));
                steps.add(step(price, leader, bid, true));
            }
        }
        return steps;
    }

    static BigDecimal increment(BigDecimal price) {
        int step = price.compareTo(BigDecimal.valueOf(50)) < 0 ? 1
                : price.compareTo(BigDecimal.valueOf(500)) < 0 ? 5
                : price.compareTo(BigDecimal.valueOf(5000)) < 0 ? 10 : 50;
        return BigDecimal.valueOf(step);
    }

    /** First and last character only, so the history tells bidders apart without naming them. */
    static String anonymous(String name) {
        String n = name.strip().toLowerCase(Locale.ROOT);
        return n.length() < 2 ? "?···?" : n.charAt(0) + "···" + n.charAt(n.length() - 1);
    }

    private static Step step(BigDecimal amount, Bid owner, Bid trigger, boolean automatic) {
        return new Step(amount, owner.getBidderId(), owner.getBidderName(), trigger.getCreatedAt(), automatic);
    }
}
