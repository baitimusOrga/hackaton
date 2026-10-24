package one.absent.hackaton.auction;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface BidRepository extends JpaRepository<Bid, Long> {
    List<Bid> findByListingIdOrderByCreatedAtAscIdAsc(long listingId);
}
