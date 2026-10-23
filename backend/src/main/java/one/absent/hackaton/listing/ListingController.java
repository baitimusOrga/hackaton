package one.absent.hackaton.listing;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import one.absent.hackaton.config.JwtService;
import one.absent.hackaton.user.UserRepository;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/listings")
@Validated
public class ListingController {

    public record ListingDto(Long id, String title, String description, Integer priceCents,
                             String imageUrl, Long ownerId, String ownerName, Instant createdAt) {
        static ListingDto of(Listing l) {
            String image = l.getImageKey() == null ? null : "/api/listings/" + l.getId() + "/image";
            return new ListingDto(l.getId(), l.getTitle(), l.getDescription(), l.getPriceCents(), image,
                    l.getOwner().getId(), l.getOwner().getDisplayName(), l.getCreatedAt());
        }
    }

    public record PageDto<T>(List<T> items, int page, int size, long total) {
        static <T> PageDto<T> of(Page<T> p) {
            return new PageDto<>(p.getContent(), p.getNumber(), p.getSize(), p.getTotalElements());
        }
    }

    private final ListingRepository listings;
    private final UserRepository users;
    private final ImageStorage images;

    public ListingController(ListingRepository listings, UserRepository users, ImageStorage images) {
        this.listings = listings;
        this.users = users;
        this.images = images;
    }

    @GetMapping
    public PageDto<ListingDto> list(@RequestParam(defaultValue = "0") @Min(0) int page,
                                    @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return PageDto.of(listings.findAllByOrderByCreatedAtDesc(PageRequest.of(page, size)).map(ListingDto::of));
    }

    @GetMapping("/{id}")
    public ListingDto get(@PathVariable Long id) {
        return ListingDto.of(find(id));
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public ListingDto create(@AuthenticationPrincipal Jwt principal,
                             @RequestParam @NotBlank @Size(max = 120) String title,
                             @RequestParam @NotBlank @Size(max = 4000) String description,
                             @RequestParam(required = false) @Min(0) Integer priceCents,
                             @RequestPart(required = false) MultipartFile image) {
        var owner = users.findById(JwtService.userId(principal))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        String imageKey = image == null || image.isEmpty() ? null : images.save(image);
        return ListingDto.of(listings.save(new Listing(owner, title.trim(), description.trim(), priceCents, imageKey)));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void delete(@AuthenticationPrincipal Jwt principal, @PathVariable Long id) {
        Listing listing = find(id);
        if (!listing.getOwner().getId().equals(JwtService.userId(principal))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your listing");
        }
        listings.delete(listing);
        if (listing.getImageKey() != null) {
            images.delete(listing.getImageKey());
        }
    }

    @GetMapping("/{id}/image")
    public ResponseEntity<Resource> image(@PathVariable Long id) {
        String key = find(id).getImageKey();
        return images.find(key)
                .map(p -> ResponseEntity.ok()
                        .contentType(images.mediaType(key))
                        .cacheControl(CacheControl.maxAge(Duration.ofDays(30)).cachePublic().immutable())
                        .<Resource>body(new FileSystemResource(p)))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }

    private Listing find(Long id) {
        return listings.findWithOwnerById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Listing not found"));
    }
}
