package one.absent.hackaton.selling;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Set;

import io.swagger.v3.oas.annotations.tags.Tag;
import one.absent.hackaton.ai.AiClient;
import one.absent.hackaton.listing.Condition;
import one.absent.hackaton.selling.ListingDraft.DraftFact;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

/** Turns seller photos into a listing draft and serves stored photos. */
@Tag(name = "Selling")
@RestController
public class DraftController {
    // the image types the Anthropic API accepts
    private static final Set<String> IMAGE_TYPES = Set.of("image/jpeg", "image/png", "image/gif", "image/webp");
    private static final long MAX_BYTES = 5L * 1024 * 1024;

    static final String SYSTEM = """
            You prepare a listing draft for a Swiss secondhand marketplace from the seller's photos.
            Rules:
            - facts: only text you can read on a label, type plate, screen or datasheet gets source LABEL.
              Everything you infer from appearance gets source SUGGESTION. Never use any other source.
            - Never invent internal specs (CPU, RAM, storage, ...) unless they are readable on a label or screen.
              Never claim working condition, ownership or included accessories.
            - Fact names only from the allowed list; values short and normalized (e.g. 27", 16 GB, 2560x1440).
              One fact per name at most; leave out what you cannot see.
            - If the exact model or variant is uncertain, add a concrete tip to questions, e.g.
              "Please photograph the type plate on the back" or "Please photograph the model label".
              Questions are short, at most 4.
            - title: concise, at most 80 characters, brand and model first when known.
            - description: 2 to 4 factual sentences in English about what is visible, including visible wear;
              no marketing language, no claims about function.
            - condition: your best guess from visible wear (NEW, LIKE_NEW, GOOD, USED, DEFECTIVE), null if unclear.
            - category: the best fit from the allowed list.
            """;

    static final String SCHEMA = """
            {"type": "object", "additionalProperties": false,
             "required": ["category", "title", "description", "condition", "facts", "questions"],
             "properties": {
               "category": {"type": "string", "enum": ["Computers", "Laptops", "Monitors", "Phones", "Tablets",
                 "Office furniture", "Audio", "Cameras", "Household", "Bikes"]},
               "title": {"type": "string"},
               "description": {"type": "string"},
               "condition": {"anyOf": [{"type": "string", "enum": ["NEW", "LIKE_NEW", "GOOD", "USED", "DEFECTIVE"]},
                 {"type": "null"}]},
               "facts": {"type": "array", "items": {"type": "object", "additionalProperties": false,
                 "required": ["name", "value", "source"],
                 "properties": {
                   "name": {"type": "string", "enum": ["Brand", "Model", "Year", "Color", "Size", "Display",
                     "Resolution", "CPU", "RAM", "Storage", "Material", "Dimensions"]},
                   "value": {"type": "string"},
                   "source": {"type": "string", "enum": ["LABEL", "SUGGESTION"]}}}},
               "questions": {"type": "array", "items": {"type": "string"}}}}
            """;

    record AiDraft(String category, String title, String description, Condition condition,
                   List<DraftFact> facts, List<String> questions) {}

    private final PhotoRepository photos;
    private final AiClient ai;
    private final PriceEstimator prices;

    public DraftController(PhotoRepository photos, AiClient ai, PriceEstimator prices) {
        this.photos = photos;
        this.ai = ai;
        this.prices = prices;
    }

    @PostMapping(value = "/api/listing-drafts", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ListingDraft createDraft(@RequestPart("photos") List<MultipartFile> files,
                                    @AuthenticationPrincipal Jwt seller) {
        if (files.isEmpty() || files.size() > 5) {
            throw badRequest("Please add between 1 and 5 photos.");
        }
        for (MultipartFile file : files) {
            if (!IMAGE_TYPES.contains(file.getContentType())) {
                throw badRequest("Photos must be JPEG, PNG, GIF or WebP images.");
            }
            if (file.isEmpty() || file.getSize() > MAX_BYTES) {
                throw badRequest("Each photo must be at most 5 MB.");
            }
        }
        List<Photo> stored = files.stream().map(file -> photos.save(photo(file, seller.getSubject()))).toList();
        List<AiClient.Image> images = stored.stream()
                .map(p -> new AiClient.Image(p.getData(), p.getContentType())).toList();
        AiDraft draft = ai.ask(SYSTEM, "Create the listing draft for the item in these photos.", images, SCHEMA,
                AiDraft.class);
        return new ListingDraft(stored.stream().map(Photo::getId).toList(), draft.category(), draft.title(),
                draft.description(), draft.condition(), draft.facts(), draft.questions(),
                prices.estimate(draft.category(), draft.title(), draft.facts(), draft.condition()));
    }

    @GetMapping("/api/photos/{id}")
    public ResponseEntity<byte[]> getPhoto(@PathVariable long id) {
        Photo photo = photos.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Photo not found."));
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(photo.getContentType()))
                .cacheControl(CacheControl.maxAge(Duration.ofDays(1)).cachePublic())
                .body(photo.getData());
    }

    private static Photo photo(MultipartFile file, String sellerId) {
        var photo = new Photo();
        photo.setContentType(file.getContentType());
        try {
            photo.setData(file.getBytes());
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        photo.setSellerId(sellerId);
        photo.setCreatedAt(Instant.now());
        return photo;
    }

    private static ResponseStatusException badRequest(String reason) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, reason);
    }
}
