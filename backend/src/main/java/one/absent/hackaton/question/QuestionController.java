package one.absent.hackaton.question;

import java.time.Instant;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import one.absent.hackaton.listing.Listing;
import one.absent.hackaton.listing.ListingRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/** Public questions on a listing: anyone reads, signed-in users ask, only the seller answers. */
@Tag(name = "Questions")
@RestController
@RequestMapping("/api/listings/{listingId}/questions")
@Transactional
public class QuestionController {

    public record AskRequest(@NotBlank @Size(max = 1000) String text) {}

    public record AnswerRequest(@NotBlank @Size(max = 1000) String answer) {}

    /** {@code canAnswer} is true when the caller is the listing's seller. */
    public record QuestionView(long id, String askerName, String text, Instant createdAt,
                               @Schema(nullable = true) String answer,
                               @Schema(nullable = true) Instant answeredAt, boolean canAnswer) {}

    private final ListingQuestionRepository questions;
    private final ListingRepository listings;

    public QuestionController(ListingQuestionRepository questions, ListingRepository listings) {
        this.questions = questions;
        this.listings = listings;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<QuestionView> list(@PathVariable long listingId, @AuthenticationPrincipal Jwt user) {
        boolean seller = isSeller(listing(listingId), user);
        return questions.findByListingIdOrderByCreatedAtAscIdAsc(listingId).stream()
                .map(q -> view(q, seller)).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public QuestionView ask(@PathVariable long listingId, @Valid @RequestBody AskRequest request,
                            @AuthenticationPrincipal Jwt user) {
        Listing listing = listing(listingId);
        var question = new ListingQuestion();
        question.setListingId(listingId);
        question.setAskerId(user.getSubject());
        String name = user.getClaimAsString("name");
        question.setAskerName(name == null || name.isBlank() ? "?" : name);
        question.setText(request.text().strip());
        question.setCreatedAt(Instant.now());
        return view(questions.save(question), isSeller(listing, user));
    }

    @PutMapping("/{questionId}/answer")
    public QuestionView answer(@PathVariable long listingId, @PathVariable long questionId,
                               @Valid @RequestBody AnswerRequest request, @AuthenticationPrincipal Jwt user) {
        if (!isSeller(listing(listingId), user)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the seller can answer questions.");
        }
        var question = questions.findById(questionId).filter(q -> q.getListingId() == listingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Question not found."));
        question.setAnswer(request.answer().strip());
        question.setAnsweredAt(Instant.now());
        return view(question, true);
    }

    private Listing listing(long id) {
        return listings.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Listing not found."));
    }

    // demo listings have no seller, so nobody can answer there
    private static boolean isSeller(Listing listing, Jwt user) {
        return user != null && listing.getSellerId() != null && listing.getSellerId().equals(user.getSubject());
    }

    private static QuestionView view(ListingQuestion q, boolean canAnswer) {
        return new QuestionView(q.getId(), q.getAskerName(), q.getText(), q.getCreatedAt(), q.getAnswer(),
                q.getAnsweredAt(), canAnswer);
    }
}
