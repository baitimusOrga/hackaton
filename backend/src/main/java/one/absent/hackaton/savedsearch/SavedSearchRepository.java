package one.absent.hackaton.savedsearch;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface SavedSearchRepository extends JpaRepository<SavedSearch, Long> {
    List<SavedSearch> findByOwnerIdOrderByCreatedAtDesc(String ownerId);

    Optional<SavedSearch> findByIdAndOwnerId(Long id, String ownerId);
}
