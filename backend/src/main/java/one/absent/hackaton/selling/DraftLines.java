package one.absent.hackaton.selling;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

import lombok.extern.slf4j.Slf4j;
import one.absent.hackaton.listing.Categories;
import one.absent.hackaton.listing.Condition;
import one.absent.hackaton.selling.DraftEvent.Detection;
import one.absent.hackaton.selling.DraftEvent.Gap;
import one.absent.hackaton.selling.DraftEvent.GapKind;
import one.absent.hackaton.selling.DraftEvent.PrivacyMark;
import one.absent.hackaton.selling.ListingDraft.DraftFact;
import one.absent.hackaton.selling.ListingDraft.FactSource;
import one.absent.hackaton.selling.ListingDraft.PrivacyWarning;
import one.absent.hackaton.selling.PhotoImages.AiPhoto;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

/**
 * Checks the AI's JSON lines one by one: detections and privacy marks are emitted at once, gaps wait for the
 * draft's category. Invalid lines are dropped, never the stream.
 */
@Slf4j
class DraftLines implements Consumer<String> {
    static final String CONDITION = "Condition";

    /** Any line the AI may write; {@code type} says which fields are used. */
    record AiLine(String type, Integer photo, List<Double> box, String label, DraftFact fact, String text,
                  String name, GapKind kind, String prompt, List<String> options, String category, String title,
                  String description, Condition condition, List<DraftFact> facts) {}

    private final JsonMapper json;
    private final List<AiPhoto> photos;
    private final Consumer<DraftEvent> emit;
    private final List<Gap> gaps = new ArrayList<>();
    private final List<PrivacyWarning> privacy = new ArrayList<>();
    private AiLine draft;

    DraftLines(JsonMapper json, List<AiPhoto> photos, Consumer<DraftEvent> emit) {
        this.json = json;
        this.photos = photos;
        this.emit = emit;
    }

    @Override
    public void accept(String line) {
        AiLine l;
        try {
            l = json.readValue(line, AiLine.class);
        } catch (JacksonException e) {
            log.debug("Dropped AI line that is not JSON: {}", line);
            return;
        }
        boolean valid = switch (String.valueOf(l.type())) {
            case "detection" -> {
                List<Double> box = fractions(l);
                boolean ok = box != null && l.label() != null && (l.fact() == null || factOk(l.fact()));
                if (ok) {
                    emit.accept(DraftEvent.of(new Detection(l.photo(), box, l.label(), l.fact())));
                }
                yield ok;
            }
            case "privacy" -> {
                List<Double> box = fractions(l);
                boolean ok = box != null && l.text() != null;
                if (ok) {
                    privacy.add(new PrivacyWarning(l.photo(), l.text()));
                    emit.accept(DraftEvent.of(new PrivacyMark(l.photo(), box, l.text())));
                }
                yield ok;
            }
            case "gap" -> {
                boolean ok = l.name() != null && l.kind() != null && l.prompt() != null
                        && (CONDITION.equals(l.name()) || Categories.FACT_NAMES.contains(l.name()));
                if (ok) {
                    // a hint box that is not on one of the photos is dropped, the question stays
                    List<Double> hint = fractions(l);
                    gaps.add(new Gap(l.name(), l.kind(), l.prompt(), l.options() == null ? List.of() : l.options(),
                            hint != null ? l.photo() : null, hint));
                }
                yield ok;
            }
            case "draft" -> {
                boolean ok = Categories.ALL.contains(l.category()) && l.title() != null && l.description() != null;
                if (ok) {
                    draft = l;
                }
                yield ok;
            }
            default -> false;
        };
        if (!valid) {
            log.debug("Dropped invalid AI line: {}", line);
        }
    }

    /** Emits the gaps of the draft's category, then the draft with its price. */
    void finish(List<Long> photoIds, PriceEstimator prices) {
        if (draft == null) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI gave no usable answer, please try again.");
        }
        List<String> keyFacts = Categories.KEY_FACTS.get(draft.category());
        gaps.stream()
                .filter(g -> CONDITION.equals(g.fact()) || keyFacts.contains(g.fact()))
                .forEach(g -> emit.accept(DraftEvent.of(g)));
        List<DraftFact> facts = draft.facts() == null ? List.of()
                : draft.facts().stream().filter(DraftLines::factOk).toList();
        String title = DraftController.shortTitle(draft.title());
        emit.accept(DraftEvent.of(new ListingDraft(photoIds, draft.category(), title, draft.description(),
                draft.condition(), facts, prices.estimate(draft.category(), draft.title(), facts, draft.condition()),
                List.copyOf(privacy))));
    }

    /**
     * The line's box (pixels of its photo) as fractions x, y, width, height of that photo; null when the photo
     * does not exist, its size is unknown or the box is not on it. A box a few pixels over the edge is cut.
     */
    private List<Double> fractions(AiLine l) {
        List<Double> b = l.box();
        if (l.photo() == null || l.photo() < 1 || l.photo() > photos.size() || b == null || b.size() != 4
                || b.stream().anyMatch(v -> v == null || v < 0)) {
            return null;
        }
        AiPhoto photo = photos.get(l.photo() - 1);
        if (photo.width() == null) {
            return null;
        }
        double w = photo.width();
        double h = photo.height();
        double x = b.get(0) / w;
        double y = b.get(1) / h;
        double width = b.get(2) / w;
        double height = b.get(3) / h;
        if (width <= 0 || height <= 0 || x >= 1 || y >= 1 || x + width > 1.02 || y + height > 1.02) {
            return null;
        }
        return List.of(x, y, Math.min(width, 1 - x), Math.min(height, 1 - y));
    }

    private static boolean factOk(DraftFact f) {
        return f.name() != null && Categories.FACT_NAMES.contains(f.name()) && f.value() != null
                && !f.value().isBlank() && (f.source() == FactSource.LABEL || f.source() == FactSource.SUGGESTION);
    }
}
