package one.absent.hackaton.auction;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface BidRepository extends JpaRepository<Bid, Long> {
    /** In the order the bids were accepted: inserts are serialised by the listing's row lock. */
    List<Bid> findByListingIdOrderByIdAsc(long listingId);
}
