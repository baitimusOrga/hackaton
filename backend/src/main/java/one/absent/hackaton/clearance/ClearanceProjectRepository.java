package one.absent.hackaton.clearance;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ClearanceProjectRepository extends JpaRepository<ClearanceProject, Long> {
    List<ClearanceProject> findByOwnerIdOrderByCreatedAtDesc(String ownerId);
}
