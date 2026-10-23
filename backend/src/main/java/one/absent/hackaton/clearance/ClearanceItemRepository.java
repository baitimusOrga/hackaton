package one.absent.hackaton.clearance;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ClearanceItemRepository extends JpaRepository<ClearanceItem, Long> {
    List<ClearanceItem> findByProjectIdOrderById(Long projectId);
}
