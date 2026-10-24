package one.absent.hackaton.bookmark;

import java.time.Instant;
import java.util.List;

import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import one.absent.hackaton.listing.ListingRepository;
import one.absent.hackaton.listing.ListingSummary;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Signed in: a user's own "Merken" list. */
@Tag(name = "Bookmarks")
@RestController
@RequiredArgsConstructor
@Transactional
public class BookmarkController {

    private final BookmarkRepository bookmarks;
    private final ListingRepository listings;

    @GetMapping("/api/bookmarks")
    @Transactional(readOnly = true)
    public List<ListingSummary> mine(@AuthenticationPrincipal Jwt user) {
        return bookmarks.listingsOf(user.getSubject()).stream().map(l -> l.detail().summary()).toList();
    }

    /** Idempotent: bookmarking twice keeps one bookmark. */
    @PutMapping("/api/listings/{id}/bookmark")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void add(@PathVariable long id, @AuthenticationPrincipal Jwt user) {
        if (!listings.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Listing not found.");
        }
        if (!bookmarks.existsByUserIdAndListingId(user.getSubject(), id)) {
            var bookmark = new Bookmark();
            bookmark.setUserId(user.getSubject());
            bookmark.setListingId(id);
            bookmark.setCreatedAt(Instant.now());
            bookmarks.save(bookmark);
        }
    }

    @DeleteMapping("/api/listings/{id}/bookmark")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@PathVariable long id, @AuthenticationPrincipal Jwt user) {
        bookmarks.deleteByUserIdAndListingId(user.getSubject(), id);
    }
}
