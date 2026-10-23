package one.absent.hackaton.listing;

import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ListingRepository extends JpaRepository<Listing, Long> {

    @EntityGraph(attributePaths = "owner")
    Page<Listing> findAllByOrderByCreatedAtDesc(Pageable pageable);

    @EntityGraph(attributePaths = "owner")
    Optional<Listing> findWithOwnerById(Long id);
}
