package one.absent.hackaton.listing;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface ListingRepository extends JpaRepository<Listing, Long> {

    /** Every filter is optional (null = ignored); {@code q} and {@code postcode} are ready-made LIKE patterns;
     *  the lat/lon box (null = ignored) is the SQL prefilter of a radius search. */
    @Query("""
            select l from Listing l
            where l.status = one.absent.hackaton.listing.ListingStatus.AVAILABLE
              and (:q is null or lower(l.title) like :q or lower(l.description) like :q)
              and (:category is null or lower(l.category) = :category)
              and (:maxPrice is null or l.priceChf <= :maxPrice)
              and (:postcode is null or l.postcode like :postcode)
              and (:saleMode is null or l.saleMode = :saleMode)
              and (:endsBefore is null or l.endsAt < :endsBefore)
              and (:minLat is null or (l.latitude between :minLat and :maxLat
                                       and l.longitude between :minLon and :maxLon))
            order by l.createdAt desc, l.id desc
            """)
    List<Listing> search(String q, String category, BigDecimal maxPrice, String postcode, SaleMode saleMode,
                           Instant endsBefore, Double minLat, Double maxLat, Double minLon, Double maxLon);

    List<Listing> findBySellerIdAndStatusOrderByCreatedAtDesc(String sellerId, ListingStatus status);

    List<Listing> findBySellerIdOrderByCreatedAtDesc(String sellerId);

    List<Listing> findByBuyerIdOrderByCreatedAtDesc(String buyerId);

    @Query("select p.id from Photo p where p.listingId = :listingId order by p.id")
    List<Long> findPhotoIds(long listingId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select l from Listing l where l.id = :id")
    Optional<Listing> findForUpdate(long id);

    @Query("""
            select l.id from Listing l
            where l.saleMode = one.absent.hackaton.listing.SaleMode.AUCTION
              and l.status = one.absent.hackaton.listing.ListingStatus.AVAILABLE and l.endsAt <= :now
            """)
    List<Long> findDueAuctionIds(Instant now);
}
