package one.absent.hackaton.selling;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import one.absent.hackaton.selling.ListingDraft.DraftFact;

/** One server-sent event of the draft stream; {@code type} says which of the other fields is set. */
public record DraftEvent(Type type, @Schema(nullable = true) Detection detection,
                         @Schema(nullable = true) PrivacyMark privacy, @Schema(nullable = true) Gap gap,
                         @Schema(nullable = true) ListingDraft draft, @Schema(nullable = true) String detail) {

    public enum Type { DETECTION, PRIVACY, GAP, DRAFT, ERROR }

    public enum GapKind { PHOTO, ASK, CONFIRM }

    /** {@code photo} is 1-based; {@code box} is x, y, width, height as fractions of the image. */
    public record Detection(int photo, List<Double> box, String label, @Schema(nullable = true) DraftFact fact) {}

    public record PrivacyMark(int photo, List<Double> box, String text) {}

    /** How to ask for a missing key fact; {@code fact} is a key fact name or "Condition". */
    public record Gap(String fact, GapKind kind, String prompt, List<String> options) {}

    static DraftEvent of(Detection detection) {
        return new DraftEvent(Type.DETECTION, detection, null, null, null, null);
    }

    static DraftEvent of(PrivacyMark privacy) {
        return new DraftEvent(Type.PRIVACY, null, privacy, null, null, null);
    }

    static DraftEvent of(Gap gap) {
        return new DraftEvent(Type.GAP, null, null, gap, null, null);
    }

    static DraftEvent of(ListingDraft draft) {
        return new DraftEvent(Type.DRAFT, null, null, null, draft, null);
    }

    static DraftEvent error(String detail) {
        return new DraftEvent(Type.ERROR, null, null, null, null, detail);
    }
}
