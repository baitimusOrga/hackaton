package one.absent.hackaton.bookmark;

import java.util.List;

import one.absent.hackaton.listing.Listing;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface BookmarkRepository extends JpaRepository<Bookmark, Long> {

    boolean existsByUserIdAndListingId(String userId, Long listingId);

    void deleteByUserIdAndListingId(String userId, Long listingId);

    @Query("""
            select l from Listing l join Bookmark b on b.listingId = l.id
            where b.userId = :userId
            order by b.createdAt desc, b.id desc
            """)
    List<Listing> listingsOf(String userId);
}
