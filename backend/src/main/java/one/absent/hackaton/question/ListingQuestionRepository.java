package one.absent.hackaton.question;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

interface ListingQuestionRepository extends JpaRepository<ListingQuestion, Long> {
    List<ListingQuestion> findByListingIdOrderByCreatedAtAscIdAsc(long listingId);
}
