package one.absent.hackaton.listing;

import java.math.BigDecimal;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ListingRepository extends JpaRepository<Listing, Long> {

    /** Every filter is optional (null = ignored); {@code q} and {@code postcode} are ready-made LIKE patterns. */
    @Query("""
            select l from Listing l
            where l.status = one.absent.hackaton.listing.ListingStatus.AVAILABLE
              and (:q is null or lower(l.title) like :q or lower(l.description) like :q)
              and (:category is null or lower(l.category) = :category)
              and (:maxPrice is null or l.priceChf <= :maxPrice)
              and (:postcode is null or l.postcode like :postcode)
            order by l.createdAt desc, l.id desc
            """)
    List<Listing> search(String q, String category, BigDecimal maxPrice, String postcode);
}
