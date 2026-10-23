package one.absent.hackaton.photo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.HashMap;
import java.util.Map;
import java.util.function.Consumer;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

class PhotoStorageTest {

    private final Map<String, byte[]> store = new HashMap<>();
    private final Map<String, String> types = new HashMap<>();
    private final PhotoStorage storage = new PhotoStorage(fakeS3(), "bucket");

    @SuppressWarnings("unchecked")
    private S3Client fakeS3() {
        S3Client s3 = mock(S3Client.class);
        when(s3.putObject(any(Consumer.class), any(RequestBody.class))).thenAnswer(i -> {
            var b = PutObjectRequest.builder();
            i.<Consumer<PutObjectRequest.Builder>>getArgument(0).accept(b);
            var req = b.build();
            store.put(req.key(), i.<RequestBody>getArgument(1).contentStreamProvider().newStream().readAllBytes());
            types.put(req.key(), req.contentType());
            return null;
        });
        when(s3.getObjectAsBytes(any(Consumer.class))).thenAnswer(i -> {
            var b = GetObjectRequest.builder();
            i.<Consumer<GetObjectRequest.Builder>>getArgument(0).accept(b);
            var key = b.build().key();
            if (!store.containsKey(key)) {
                throw NoSuchKeyException.builder().build();
            }
            return ResponseBytes.fromByteArray(GetObjectResponse.builder().contentType(types.get(key)).build(), store.get(key));
        });
        when(s3.deleteObject(any(Consumer.class))).thenAnswer(i -> {
            var b = DeleteObjectRequest.builder();
            i.<Consumer<DeleteObjectRequest.Builder>>getArgument(0).accept(b);
            store.remove(b.build().key());
            return null;
        });
        return s3;
    }

    @Test
    void putGetDeleteRoundTrip() {
        storage.put("a", new byte[] {1, 2, 3}, "image/png");

        var photo = storage.get("a");
        assertThat(photo.bytes()).containsExactly(1, 2, 3);
        assertThat(photo.contentType()).isEqualTo("image/png");

        storage.delete("a");
        assertThatThrownBy(() -> storage.get("a")).isInstanceOfSatisfying(ResponseStatusException.class,
                e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    void rejectsOtherContentTypes() {
        assertThatThrownBy(() -> storage.put("a", new byte[1], "image/svg+xml")).isInstanceOfSatisfying(
                ResponseStatusException.class,
                e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.UNSUPPORTED_MEDIA_TYPE));
    }

    @Test
    void rejectsPhotosOverFiveMegabytes() {
        assertThatThrownBy(() -> storage.put("a", new byte[PhotoStorage.MAX_BYTES + 1], "image/jpeg"))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONTENT_TOO_LARGE));
    }
}
