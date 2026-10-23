package one.absent.hackaton.selling;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import lombok.extern.slf4j.Slf4j;
import one.absent.hackaton.photo.PhotoStorage;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.core.exception.SdkException;

/** Deletes draft photos that never made it into a listing. */
@Slf4j
@Component
public class PhotoCleanup {
    private final PhotoRepository photos;
    private final PhotoStorage storage;

    public PhotoCleanup(PhotoRepository photos, PhotoStorage storage) {
        this.photos = photos;
        this.storage = storage;
    }

    @Scheduled(cron = "0 0 * * * *")
    public void deleteOrphans() {
        delete(photos.findByListingIdIsNullAndCreatedAtBefore(Instant.now().minus(Duration.ofHours(24))));
    }

    void delete(List<Photo> orphans) {
        for (Photo photo : orphans) {
            if (photo.getStorageKey() != null) {
                try {
                    storage.delete(photo.getStorageKey());
                } catch (SdkException e) {
                    log.warn("Could not delete S3 object {}: {}", photo.getStorageKey(), e.getMessage());
                }
            }
        }
        photos.deleteAll(orphans);
    }
}
