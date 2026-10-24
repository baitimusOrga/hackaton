package one.absent.hackaton.selling;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;

import javax.imageio.ImageIO;

import one.absent.hackaton.ai.AiClient;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Re-encodes uploaded photos so EXIF data (GPS, camera serial, ...) is never stored or served. */
final class PhotoImages {
    // what Claude reads at full detail; a bigger photo is scaled down by the API, and box pixels no longer match
    static final int AI_MAX_EDGE = 2576;
    static final long AI_MAX_PIXELS = 3_750_000;

    /** A photo as sent to the AI, with its size in pixels as the AI reads it; no size when it is unreadable. */
    record AiPhoto(AiClient.Image image, Integer width, Integer height) {}

    private PhotoImages() {}

    /** Scales a stored photo down to what the AI reads at full detail, so its box pixels match the photo. */
    static AiPhoto forAi(byte[] data, String type) {
        try {
            BufferedImage image = ImageIO.read(new ByteArrayInputStream(data));
            if (image == null) {
                // no ImageIO reader for WebP: it goes as uploaded, with the size the API scales it to
                int[] size = webpSize(data);
                return size == null ? new AiPhoto(new AiClient.Image(data, type), null, null)
                        : new AiPhoto(new AiClient.Image(data, type), scaled(size[0], size[1]), scaled(size[1], size[0]));
            }
            int w = image.getWidth();
            int h = image.getHeight();
            int sw = scaled(w, h);
            int sh = scaled(h, w);
            if (sw == w) {
                return new AiPhoto(new AiClient.Image(data, type), w, h);
            }
            var small = new BufferedImage(sw, sh, BufferedImage.TYPE_INT_RGB);
            Graphics2D g = small.createGraphics();
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g.drawImage(image, 0, 0, sw, sh, Color.WHITE, null);
            g.dispose();
            var out = new ByteArrayOutputStream();
            ImageIO.write(small, "jpg", out);
            return new AiPhoto(new AiClient.Image(out.toByteArray(), "image/jpeg"), sw, sh);
        } catch (IOException e) {
            return new AiPhoto(new AiClient.Image(data, type), null, null);
        }
    }

    /** {@code side} of a {@code side} x {@code other} photo once scaled to what the AI reads at full detail. */
    private static int scaled(int side, int other) {
        double scale = Math.min(1, Math.min((double) AI_MAX_EDGE / Math.max(side, other),
                Math.sqrt((double) AI_MAX_PIXELS / ((long) side * other))));
        return scale >= 1 ? side : (int) Math.floor(side * scale);
    }

    /** Width and height from a WebP header (lossy VP8, lossless VP8L or extended VP8X); null when it is none. */
    static int[] webpSize(byte[] d) {
        if (d.length < 30 || !"RIFF".equals(ascii(d, 0)) || !"WEBP".equals(ascii(d, 8))) {
            return null;
        }
        return switch (ascii(d, 12)) {
            case "VP8 " -> new int[] {u16(d, 26) & 0x3FFF, u16(d, 28) & 0x3FFF};
            case "VP8L" -> new int[] {1 + (((d[22] & 0x3F) << 8) | (d[21] & 0xFF)),
                    1 + (((d[24] & 0x0F) << 10) | ((d[23] & 0xFF) << 2) | ((d[22] & 0xC0) >> 6))};
            case "VP8X" -> new int[] {1 + (u16(d, 24) | (d[26] & 0xFF) << 16), 1 + (u16(d, 27) | (d[29] & 0xFF) << 16)};
            default -> null;
        };
    }

    private static String ascii(byte[] d, int at) {
        return new String(d, at, 4, StandardCharsets.US_ASCII);
    }

    private static int u16(byte[] d, int at) {
        return (d[at] & 0xFF) | (d[at + 1] & 0xFF) << 8;
    }

    static byte[] stripMetadata(byte[] data, String type) {
        boolean jpeg = "image/jpeg".equals(type);
        if (!jpeg && !"image/png".equals(type)) {
            // shortcut: GIF/WebP are stored as uploaded (no WebP writer, GIF re-encode drops animation), metadata stays
            return data;
        }
        try {
            BufferedImage image = ImageIO.read(new ByteArrayInputStream(data));
            if (image == null) {
                throw unsupported();
            }
            if (jpeg) {
                image = uprightRgb(image, orientation(data));
            }
            var out = new ByteArrayOutputStream();
            if (!ImageIO.write(image, jpeg ? "jpg" : "png", out)) {
                throw unsupported();
            }
            return out.toByteArray();
        } catch (IOException e) {
            throw unsupported();
        }
    }

    /** The EXIF orientation tag of a JPEG, 1 (upright) when there is none. */
    static int orientation(byte[] jpeg) {
        try {
            ByteBuffer b = ByteBuffer.wrap(jpeg);
            // walk the segments up to start-of-scan, looking for APP1 "Exif"
            for (int i = 2; (b.get(i) & 0xFF) == 0xFF && (b.get(i + 1) & 0xFF) != 0xDA;
                 i += 2 + (b.getShort(i + 2) & 0xFFFF)) {
                if ((b.get(i + 1) & 0xFF) != 0xE1 || b.getInt(i + 4) != 0x45786966) {
                    continue;
                }
                int tiff = i + 10;
                b.order(b.get(tiff) == 'I' ? ByteOrder.LITTLE_ENDIAN : ByteOrder.BIG_ENDIAN);
                int ifd = tiff + b.getInt(tiff + 4);
                for (int n = b.getShort(ifd) & 0xFFFF, e = ifd + 2; n > 0; n--, e += 12) {
                    if ((b.getShort(e) & 0xFFFF) == 0x0112) {
                        return b.getShort(e + 8);
                    }
                }
                return 1;
            }
        } catch (IndexOutOfBoundsException e) {
            // malformed EXIF: treat as upright
        }
        return 1;
    }

    // stripping EXIF drops the orientation tag, so bake the rotation in; JPEG has no alpha, so draw onto RGB
    private static BufferedImage uprightRgb(BufferedImage src, int orientation) {
        int quarters = switch (orientation) { case 6 -> 1; case 3 -> 2; case 8 -> 3; default -> 0; };
        if (quarters == 0 && !src.getColorModel().hasAlpha()) {
            return src;
        }
        int w = src.getWidth();
        int h = src.getHeight();
        boolean swap = quarters % 2 == 1;
        var out = new BufferedImage(swap ? h : w, swap ? w : h, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics();
        g.translate(out.getWidth() / 2.0, out.getHeight() / 2.0);
        g.rotate(quarters * Math.PI / 2);
        g.translate(-w / 2.0, -h / 2.0);
        g.drawImage(src, 0, 0, null);
        g.dispose();
        return out;
    }

    private static ResponseStatusException unsupported() {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported or corrupt image");
    }
}
