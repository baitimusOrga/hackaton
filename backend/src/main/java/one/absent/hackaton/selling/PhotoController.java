package one.absent.hackaton.selling;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.extern.slf4j.Slf4j;
import one.absent.hackaton.photo.PhotoStorage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import software.amazon.awssdk.core.exception.SdkException;

/** Stores seller photos once and serves them. */
@Slf4j
@Tag(name = "Selling")
@RestController
public class PhotoController {
    // the image types the Anthropic API accepts
    private static final Set<String> IMAGE_TYPES = Set.of("image/jpeg", "image/png", "image/gif", "image/webp");
    private static final long MAX_BYTES = 5L * 1024 * 1024;

    private final PhotoRepository photos;
    private final PhotoStorage storage;
    private final boolean useS3;

    public PhotoController(PhotoRepository photos, PhotoStorage storage,
                           @Value("${s3.access-key}") String s3AccessKey) {
        this.photos = photos;
        this.storage = storage;
        // without real S3 credentials (local dev, tests) photos stay in the database
        this.useS3 = !"local".equals(s3AccessKey);
    }

    /** Stores the photos for the seller and returns their ids in upload order. */
    @PostMapping(value = "/api/photos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public List<Long> uploadPhotos(@RequestPart("photos") List<MultipartFile> files,
                                   @AuthenticationPrincipal Jwt seller) {
        if (files.isEmpty() || files.size() > 5) {
            throw badRequest("Please add between 1 and 5 photos.");
        }
        for (MultipartFile file : files) {
            if (file.getContentType() == null || !IMAGE_TYPES.contains(file.getContentType())) {
                throw badRequest("Photos must be JPEG, PNG, GIF or WebP images.");
            }
            if (file.isEmpty() || file.getSize() > MAX_BYTES) {
                throw badRequest("Each photo must be at most 5 MB.");
            }
        }
        return files.stream()
                .map(f -> photos.save(photo(PhotoImages.stripMetadata(bytes(f), f.getContentType()), f.getContentType(),
                        seller.getSubject())).getId())
                .toList();
    }

    @GetMapping("/api/photos/{id}")
    public ResponseEntity<byte[]> getPhoto(@PathVariable long id) {
        // only published photos are public; drafts are previewed from local blob URLs in the sell page
        Photo photo = photos.findById(id).filter(p -> p.getListingId() != null)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Photo not found."));
        byte[] data = photo.getStorageKey() == null ? photo.getData() : storage.get(photo.getStorageKey()).bytes();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(photo.getContentType()))
                .cacheControl(CacheControl.maxAge(Duration.ofDays(1)).cachePublic())
                .body(data);
    }

    /** The new object key, or null when S3 fails, so the upload still works with the bytes in the database. */
    private String putInS3(byte[] data, String contentType) {
        String key = "photos/" + UUID.randomUUID();
        try {
            storage.put(key, data, contentType);
            return key;
        } catch (SdkException e) {
            log.warn("S3 upload failed, keeping the photo in the database: {}", e.getMessage());
            return null;
        }
    }

    private static byte[] bytes(MultipartFile file) {
        try {
            return file.getBytes();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private Photo photo(byte[] data, String contentType, String sellerId) {
        var photo = new Photo();
        photo.setContentType(contentType);
        photo.setStorageKey(useS3 ? putInS3(data, contentType) : null);
        if (photo.getStorageKey() == null) {
            photo.setData(data);
        }
        photo.setSellerId(sellerId);
        photo.setCreatedAt(Instant.now());
        return photo;
    }

    private static ResponseStatusException badRequest(String reason) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, reason);
    }
}
