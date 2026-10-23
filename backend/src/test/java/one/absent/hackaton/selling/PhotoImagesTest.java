package one.absent.hackaton.selling;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

import javax.imageio.ImageIO;

import org.junit.jupiter.api.Test;

class PhotoImagesTest {
    // APP1 "Exif" segment, big-endian TIFF, one IFD entry: orientation (0x0112) = 6 (rotate 90° clockwise)
    private static final byte[] EXIF = {(byte) 0xFF, (byte) 0xE1, 0, 34, 'E', 'x', 'i', 'f', 0, 0,
            'M', 'M', 0, 42, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, 6, 0, 0, 0, 0, 0, 0};

    @Test void jpegLosesExifAndIsTurnedUpright() throws Exception {
        byte[] plain = DraftControllerTest.image("jpg"); // 4 x 2
        byte[] withExif = new byte[plain.length + EXIF.length];
        System.arraycopy(plain, 0, withExif, 0, 2);
        System.arraycopy(EXIF, 0, withExif, 2, EXIF.length);
        System.arraycopy(plain, 2, withExif, 2 + EXIF.length, plain.length - 2);
        assertThat(PhotoImages.orientation(withExif)).isEqualTo(6);

        byte[] stripped = PhotoImages.stripMetadata(withExif, "image/jpeg");

        assertThat(new String(stripped, StandardCharsets.ISO_8859_1)).doesNotContain("Exif");
        var image = ImageIO.read(new ByteArrayInputStream(stripped));
        assertThat(image.getWidth()).isEqualTo(2);
        assertThat(image.getHeight()).isEqualTo(4);
    }

    @Test void gifIsStoredAsUploaded() {
        byte[] gif = DraftControllerTest.image("gif");
        assertThat(Arrays.equals(PhotoImages.stripMetadata(gif, "image/gif"), gif)).isTrue();
    }
}
