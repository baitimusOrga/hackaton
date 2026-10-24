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

    @Test void aBigPhotoIsScaledToWhatTheAiReadsAndASmallOneStays() throws Exception {
        var out = new java.io.ByteArrayOutputStream();
        javax.imageio.ImageIO.write(new java.awt.image.BufferedImage(4000, 3000,
                java.awt.image.BufferedImage.TYPE_INT_RGB), "jpg", out);

        var big = PhotoImages.forAi(out.toByteArray(), "image/jpeg");
        // 12 MP is over the pixel limit before the edge limit: 3.75 MP at 4:3
        assertThat(big.width()).isEqualTo(2236);
        assertThat(big.height()).isEqualTo(1677);
        var decoded = javax.imageio.ImageIO.read(new java.io.ByteArrayInputStream(big.image().data()));
        assertThat(decoded.getWidth()).isEqualTo(2236);

        byte[] small = DraftControllerTest.image("png");
        var kept = PhotoImages.forAi(small, "image/png");
        assertThat(kept.image().data()).isSameAs(small);
        assertThat(kept.width()).isEqualTo(4);
        assertThat(kept.height()).isEqualTo(2);
    }

    /** A WebP header of the given chunk type with {@code payload} from byte 20 on. */
    static byte[] webp(String chunk, int... payload) {
        byte[] d = new byte[40];
        System.arraycopy("RIFF".getBytes(), 0, d, 0, 4);
        System.arraycopy("WEBP".getBytes(), 0, d, 8, 4);
        System.arraycopy(chunk.getBytes(), 0, d, 12, 4);
        for (int i = 0; i < payload.length; i++) {
            d[20 + i] = (byte) payload[i];
        }
        return d;
    }

    @Test void webpGetsItsSizeFromTheHeaderAndTheScaleTheApiApplies() {
        // lossy: 613x460 at bytes 26-29 after frame tag and start code
        byte[] lossy = webp("VP8 ", 0, 0, 0, 0x9D, 0x01, 0x2A, 613 & 0xFF, 613 >> 8, 460 & 0xFF, 460 >> 8);
        // lossless: signature 0x2F, then 14 bits width - 1 and 14 bits height - 1
        int bits = 799 | (599 << 14);
        byte[] lossless = webp("VP8L", 0x2F, bits & 0xFF, bits >> 8 & 0xFF, bits >> 16 & 0xFF, bits >> 24 & 0xFF);
        // extended: 24 bits canvas width - 1 and height - 1 at bytes 24-29
        byte[] extended = webp("VP8X", 0, 0, 0, 0, 3999 & 0xFF, 3999 >> 8, 0, 2999 & 0xFF, 2999 >> 8, 0);

        assertThat(PhotoImages.webpSize(lossy)).containsExactly(613, 460);
        assertThat(PhotoImages.webpSize(lossless)).containsExactly(800, 600);
        assertThat(PhotoImages.webpSize(extended)).containsExactly(4000, 3000);
        assertThat(PhotoImages.webpSize(new byte[40])).isNull();

        var small = PhotoImages.forAi(lossy, "image/webp");
        assertThat(small.image().data()).isSameAs(lossy);
        assertThat(small.width()).isEqualTo(613);
        // too big for full detail: sent as is, with the size the API scales it to
        var big = PhotoImages.forAi(extended, "image/webp");
        assertThat(big.width()).isEqualTo(2236);
        assertThat(big.height()).isEqualTo(1677);
    }

    @Test void gifIsStoredAsUploaded() {
        byte[] gif = DraftControllerTest.image("gif");
        assertThat(Arrays.equals(PhotoImages.stripMetadata(gif, "image/gif"), gif)).isTrue();
    }
}
