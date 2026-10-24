package one.absent.hackaton.selling;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import one.absent.hackaton.photo.PhotoStorage;
import one.absent.hackaton.selling.PhotoImages.AiPhoto;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/** The seller's unpublished photos, ready for the AI. */
@Component
class DraftPhotos {
    private final PhotoRepository photos;
    private final PhotoStorage storage;

    DraftPhotos(PhotoRepository photos, PhotoStorage storage) {
        this.photos = photos;
        this.storage = storage;
    }

    /** The photos in request order, scaled for the AI; a foreign or published photo is rejected. */
    List<AiPhoto> forAi(List<Long> ids, String sellerId) {
        Map<Long, Photo> found = photos.findAllById(ids).stream()
                .collect(Collectors.toMap(Photo::getId, Function.identity()));
        return ids.stream().map(id -> {
            Photo photo = found.get(id);
            if (photo == null || !photo.getSellerId().equals(sellerId) || photo.getListingId() != null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown photo.");
            }
            byte[] data = photo.getStorageKey() == null ? photo.getData() : storage.get(photo.getStorageKey()).bytes();
            return PhotoImages.forAi(data, photo.getContentType());
        }).toList();
    }

    /** "Photo sizes in pixels: photo 1 is 2236x1677, ..." for the prompt; photos of unknown size are left out. */
    static String sizes(List<AiPhoto> photos) {
        return IntStream.range(0, photos.size())
                .filter(i -> photos.get(i).width() != null)
                .mapToObj(i -> "photo %d is %dx%d".formatted(i + 1, photos.get(i).width(), photos.get(i).height()))
                .collect(Collectors.joining(", ", "Photo sizes in pixels (width x height): ", "."));
    }
}
