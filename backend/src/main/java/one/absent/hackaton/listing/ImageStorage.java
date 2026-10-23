package one.absent.hackaton.listing;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Arrays;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

/**
 * Listing images on local disk: UPLOAD_DIR (in the containers a named volume, backed up with the VM).
 * Only JPEG, PNG and WebP, recognised by their first bytes, not by the client's content type.
 */
@Component
public class ImageStorage {

    private static final Pattern KEY = Pattern.compile("[0-9a-f-]{36}\\.(jpg|png|webp)");
    private static final Map<String, MediaType> TYPES = Map.of(
            "jpg", MediaType.IMAGE_JPEG, "png", MediaType.IMAGE_PNG, "webp", MediaType.parseMediaType("image/webp"));

    private final Path dir;

    public ImageStorage(@Value("${app.uploads.dir}") String dir) throws IOException {
        this.dir = Path.of(dir).toAbsolutePath();
        Files.createDirectories(this.dir);
    }

    /** Stores the file and returns its key. */
    public String save(MultipartFile file) {
        try (InputStream in = file.getInputStream()) {
            byte[] head = in.readNBytes(12);
            String ext = sniff(head).orElseThrow(() ->
                    new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Image must be JPEG, PNG or WebP"));
            String key = UUID.randomUUID() + "." + ext;
            Path tmp = Files.createTempFile(dir, "upload-", ".part");
            try (InputStream all = file.getInputStream()) {
                Files.copy(all, tmp, StandardCopyOption.REPLACE_EXISTING);
            }
            Files.move(tmp, dir.resolve(key), StandardCopyOption.ATOMIC_MOVE);
            return key;
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    public Optional<Path> find(String key) {
        if (key == null || !KEY.matcher(key).matches()) {
            return Optional.empty();
        }
        Path p = dir.resolve(key);
        return Files.isRegularFile(p) ? Optional.of(p) : Optional.empty();
    }

    public MediaType mediaType(String key) {
        return TYPES.get(key.substring(key.lastIndexOf('.') + 1));
    }

    public void delete(String key) {
        find(key).ifPresent(p -> {
            try {
                Files.deleteIfExists(p);
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
        });
    }

    static Optional<String> sniff(byte[] h) {
        if (h.length >= 3 && (h[0] & 0xff) == 0xff && (h[1] & 0xff) == 0xd8 && (h[2] & 0xff) == 0xff) {
            return Optional.of("jpg");
        }
        if (h.length >= 8 && Arrays.equals(Arrays.copyOf(h, 8),
                new byte[] {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'})) {
            return Optional.of("png");
        }
        if (h.length >= 12 && h[0] == 'R' && h[1] == 'I' && h[2] == 'F' && h[3] == 'F'
                && h[8] == 'W' && h[9] == 'E' && h[10] == 'B' && h[11] == 'P') {
            return Optional.of("webp");
        }
        return Optional.empty();
    }
}
