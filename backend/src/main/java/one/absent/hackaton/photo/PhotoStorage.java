package one.absent.hackaton.photo;

import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;

/** Photo bytes in the private S3 bucket; the caller owns the key. */
@Service
public class PhotoStorage {

    static final int MAX_BYTES = 5 * 1024 * 1024;
    static final Set<String> TYPES = Set.of("image/jpeg", "image/png", "image/webp");

    public record Photo(byte[] bytes, String contentType) {
    }

    private final S3Client s3;
    private final String bucket;

    public PhotoStorage(S3Client s3, @Value("${s3.bucket}") String bucket) {
        this.s3 = s3;
        this.bucket = bucket;
    }

    public void put(String key, byte[] bytes, String contentType) {
        if (!TYPES.contains(contentType)) {
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Only JPEG, PNG and WebP photos are allowed");
        }
        if (bytes.length > MAX_BYTES) {
            throw new ResponseStatusException(HttpStatus.CONTENT_TOO_LARGE, "Photos may be at most 5 MB");
        }
        s3.putObject(r -> r.bucket(bucket).key(key).contentType(contentType), RequestBody.fromBytes(bytes));
    }

    public Photo get(String key) {
        try {
            var object = s3.getObjectAsBytes(r -> r.bucket(bucket).key(key));
            return new Photo(object.asByteArray(), object.response().contentType());
        } catch (NoSuchKeyException e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Photo not found");
        }
    }

    public void delete(String key) {
        s3.deleteObject(r -> r.bucket(bucket).key(key));
    }
}
