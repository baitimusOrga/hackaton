package one.absent.hackaton.auction;

import java.util.List;

import one.absent.hackaton.listing.Listing;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface BidRepository extends JpaRepository<Bid, Long> {
    /** In the order the bids were accepted: inserts are serialised by the listing's row lock. */
    List<Bid> findByListingIdOrderByIdAsc(long listingId);

    @Query("""
            select l from Listing l
            where l.status = one.absent.hackaton.listing.ListingStatus.SOLD
              and exists (select b.id from Bid b where b.listingId = l.id and b.bidderId = :bidderId)
            order by l.endsAt desc, l.id desc
            """)
    List<Listing> findSoldAuctionsBidOnBy(String bidderId);
}
