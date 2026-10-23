package one.absent.hackaton.selling;

import java.time.Instant;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface PhotoRepository extends JpaRepository<Photo, Long> {
    List<Photo> findByListingIdIsNullAndCreatedAtBefore(Instant cutoff);
}
