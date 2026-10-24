# Sell guided flow — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the sell page's free-text tips with live, streamed photo detections and a guided, skippable gap flow driven by a thin category catalog.

**Architecture:** Photos are uploaded once (`POST /api/photos`). `POST /api/listing-drafts/stream` streams the AI's NDJSON answer: each valid line becomes a server-sent event (`DraftEvent`), the draft with price comes last. The frontend reads the stream with one hand-written `fetch`, computes open gaps from the category catalog (`GET /api/categories`) and walks the seller through them before the review form.

**Tech Stack:** Spring Boot 4.1 (`StreamingResponseBody`, `RestClient.exchange`), Jackson 3, Angular 22 signals, Vitest.

**Spec:** [`docs/superpowers/specs/2026-10-24-sell-guided-flow-design.md`](../specs/2026-10-24-sell-guided-flow-design.md)

**Work on branch** `spec/sell-guided-flow` (or a feature branch cut from it). Commands run from the repo root unless a `cd` is shown.

## File map

| File | Change | Responsibility |
|---|---|---|
| `backend/.../listing/Categories.java` | modify | add `KEY_FACTS`, `FACT_NAMES` |
| `backend/.../listing/CategoryController.java` | create | `GET /api/categories` |
| `backend/.../selling/PhotoController.java` | create | `POST /api/photos`, `GET /api/photos/{id}` (moved) |
| `backend/.../selling/DraftController.java` | rewrite | prompt + `POST /api/listing-drafts/stream` |
| `backend/.../selling/DraftEvent.java` | create | SSE event records |
| `backend/.../selling/DraftLines.java` | create | parse + validate NDJSON lines, emit events, build final draft |
| `backend/.../selling/ListingDraft.java` | modify | drop `questions` |
| `backend/.../ai/AiClient.java` | modify | `streamLines(...)` |
| `backend/.../config/SecurityConfig.java` | modify | `POST /api/photos` authenticated |
| `backend/src/main/resources/application.yml` | modify | async request timeout |
| `frontend/src/app/draft-stream.ts` | create | hand-written stream reader |
| `frontend/src/app/gaps.ts` | create | pure gap computation |
| `frontend/src/app/pages/sell.ts` | rewrite | state machine PHOTOS → ANALYZING → GAPS → REVIEW |
| `AGENTS.md` | modify | note the one hand-written API call |

The frontend does not compile between Task 6 (client regenerated without `createDraft`/`questions`) and Task 9. Run frontend checks only from Task 9 on.

---

### Task 1: Category catalog and `GET /api/categories`

**Files:**
- Modify: `backend/src/main/java/one/absent/hackaton/listing/Categories.java`
- Create: `backend/src/main/java/one/absent/hackaton/listing/CategoryController.java`
- Test: `backend/src/test/java/one/absent/hackaton/listing/CategoryControllerTest.java`

- [ ] **Step 1: Write the failing test**

```java
package one.absent.hackaton.listing;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.Set;

import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class CategoryControllerTest {
    final MockMvc mvc = MockMvcBuilders.standaloneSetup(new CategoryController()).build();

    @Test void everyCategoryHasKeyFactsAndAllAreAllowedNames() {
        assertThat(Categories.KEY_FACTS.keySet()).isEqualTo(Set.copyOf(Categories.ALL));
        Categories.KEY_FACTS.values().forEach(facts -> assertThat(Categories.FACT_NAMES).containsAll(facts));
        assertThat(Categories.FACT_NAMES).contains("Year", "Color");
    }

    @Test void listsCategoriesWithKeyFactsInOrder() throws Exception {
        mvc.perform(get("/api/categories"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Computers"))
                .andExpect(jsonPath("$[10].name").value("Bikes"))
                .andExpect(jsonPath("$[10].keyFacts[2]").value("Frame size"));
    }
}
```

- [ ] **Step 2: Run it, expect a compile failure** (`KEY_FACTS`, `CategoryController` missing)

Run: `cd backend && ./mvnw -q test -Dtest=CategoryControllerTest`

- [ ] **Step 3: Implement**

`Categories.java` (whole file):

```java
package one.absent.hackaton.listing;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/** The only listing categories; AI prompts and filters use this list, the frontend mirrors it in categories.ts. */
public final class Categories {

    public static final List<String> ALL = List.of("Computers", "Laptops", "Monitors", "Phones", "Tablets",
            "Office furniture", "Office equipment", "Audio", "Cameras", "Household", "Bikes");

    /** Per category the facts a good listing needs, most important first; the sell flow asks for missing ones. */
    public static final Map<String, List<String>> KEY_FACTS = Map.ofEntries(
            Map.entry("Computers", List.of("Brand", "Model", "CPU", "RAM", "Storage")),
            Map.entry("Laptops", List.of("Brand", "Model", "CPU", "RAM", "Storage", "Display")),
            Map.entry("Monitors", List.of("Brand", "Model", "Size", "Resolution")),
            Map.entry("Phones", List.of("Brand", "Model", "Storage", "Color")),
            Map.entry("Tablets", List.of("Brand", "Model", "Storage", "Display")),
            Map.entry("Office furniture", List.of("Brand", "Model", "Dimensions", "Material")),
            Map.entry("Office equipment", List.of("Brand", "Model", "Dimensions")),
            Map.entry("Audio", List.of("Brand", "Model", "Connectivity")),
            Map.entry("Cameras", List.of("Brand", "Model", "Lens mount", "Sensor")),
            Map.entry("Household", List.of("Brand", "Model", "Dimensions")),
            Map.entry("Bikes", List.of("Brand", "Model", "Frame size", "Wheel size", "Gears", "Brakes")));

    /** Every fact name the AI may use: all key facts plus a few general ones. */
    public static final List<String> FACT_NAMES = Stream.concat(
                    KEY_FACTS.values().stream().flatMap(List::stream), Stream.of("Year", "Color"))
            .distinct().sorted().toList();

    /** {@link #ALL} as a JSON array for structured-output schemas. */
    public static final String JSON = ALL.stream().map(c -> '"' + c + '"').collect(Collectors.joining(", ", "[", "]"));

    private Categories() {
    }
}
```

`CategoryController.java`:

```java
package one.absent.hackaton.listing;

import java.util.List;

import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Listings")
@RestController
public class CategoryController {

    public record CategoryInfo(String name, List<String> keyFacts) {}

    @GetMapping("/api/categories")
    public List<CategoryInfo> categories() {
        return Categories.ALL.stream().map(c -> new CategoryInfo(c, Categories.KEY_FACTS.get(c))).toList();
    }
}
```

- [ ] **Step 4: Run the test, expect PASS**

Run: `cd backend && ./mvnw -q test -Dtest=CategoryControllerTest`

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/one/absent/hackaton/listing/Categories.java backend/src/main/java/one/absent/hackaton/listing/CategoryController.java backend/src/test/java/one/absent/hackaton/listing/CategoryControllerTest.java
git commit -m "Add key facts per category and GET /api/categories"
```

---

### Task 2: Photo upload endpoint (`POST /api/photos`)

Moves photo storage out of `DraftController` so photos are stored once and re-drafts reuse them.

**Files:**
- Create: `backend/src/main/java/one/absent/hackaton/selling/PhotoController.java`
- Modify: `backend/src/main/java/one/absent/hackaton/selling/DraftController.java` (remove `getPhoto`, `putInS3`, `bytes`, `photo`, `IMAGE_TYPES`, `MAX_BYTES`, the `storage`/`useS3` fields stay until Task 5 rewrites the class)
- Modify: `backend/src/main/java/one/absent/hackaton/config/SecurityConfig.java:37`
- Test: `backend/src/test/java/one/absent/hackaton/selling/PhotoControllerTest.java`

- [ ] **Step 1: Write the failing test**

```java
package one.absent.hackaton.selling;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class PhotoControllerTest {
    static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 1, 2, 3};
    @Autowired WebApplicationContext context;
    @Autowired PhotoRepository photos;
    @Autowired JsonMapper json;
    MockMvc mvc;

    @BeforeEach void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    static MockMultipartFile photo(String type) {
        return new MockMultipartFile("photos", "item", type, PNG);
    }

    @Test void uploadStoresEachPhotoOnceForTheSellerAndServesIt() throws Exception {
        long before = photos.count();
        String body = mvc.perform(multipart("/api/photos").file(photo("image/png")).file(photo("image/png"))
                        .with(jwt().jwt(j -> j.subject("seller"))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertThat(photos.count()).isEqualTo(before + 2);
        long id = json.readTree(body).get(0).asLong();
        assertThat(photos.findById(id).orElseThrow().getSellerId()).isEqualTo("seller");

        mvc.perform(get("/api/photos/" + id))
                .andExpect(status().isOk())
                .andExpect(content().contentType("image/png"))
                .andExpect(content().bytes(PNG))
                .andExpect(header().string("Cache-Control", "max-age=86400, public"));
    }

    @Test void wrongTypeIsRejected() throws Exception {
        mvc.perform(multipart("/api/photos").file(photo("application/pdf"))
                        .with(jwt().jwt(j -> j.subject("seller"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Photos must be JPEG, PNG, GIF or WebP images."));
    }

    @Test void uploadRequiresAuthentication() throws Exception {
        mvc.perform(multipart("/api/photos").file(photo("image/png")))
                .andExpect(status().isUnauthorized());
    }

    @Test void unknownPhotoIsNotFound() throws Exception {
        mvc.perform(get("/api/photos/999999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("Photo not found."));
    }
}
```

- [ ] **Step 2: Run it, expect FAIL** (404 on `POST /api/photos`)

Run: `cd backend && ./mvnw -q test -Dtest=PhotoControllerTest`

- [ ] **Step 3: Implement**

`PhotoController.java` — the upload checks and storage helpers move here unchanged from `DraftController`:

```java
package one.absent.hackaton.selling;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.extern.slf4j.Slf4j;
import one.absent.hackaton.photo.PhotoStorage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import software.amazon.awssdk.core.exception.SdkException;

/** Stores seller photos once and serves them. */
@Slf4j
@Tag(name = "Selling")
@RestController
public class PhotoController {
    // the image types the Anthropic API accepts
    private static final Set<String> IMAGE_TYPES = Set.of("image/jpeg", "image/png", "image/gif", "image/webp");
    private static final long MAX_BYTES = 5L * 1024 * 1024;

    private final PhotoRepository photos;
    private final PhotoStorage storage;
    private final boolean useS3;

    public PhotoController(PhotoRepository photos, PhotoStorage storage,
                           @Value("${s3.access-key}") String s3AccessKey) {
        this.photos = photos;
        this.storage = storage;
        // without real S3 credentials (local dev, tests) photos stay in the database
        this.useS3 = !"local".equals(s3AccessKey);
    }

    /** Stores the photos for the seller and returns their ids in upload order. */
    @PostMapping(value = "/api/photos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public List<Long> uploadPhotos(@RequestPart("photos") List<MultipartFile> files,
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
        return files.stream()
                .map(f -> photos.save(photo(bytes(f), f.getContentType(), seller.getSubject())).getId())
                .toList();
    }

    @GetMapping("/api/photos/{id}")
    public ResponseEntity<byte[]> getPhoto(@PathVariable long id) {
        Photo photo = photos.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Photo not found."));
        byte[] data = photo.getStorageKey() == null ? photo.getData() : storage.get(photo.getStorageKey()).bytes();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(photo.getContentType()))
                .cacheControl(CacheControl.maxAge(Duration.ofDays(1)).cachePublic())
                .body(data);
    }

    /** The new object key, or null when S3 fails, so the upload still works with the bytes in the database. */
    private String putInS3(byte[] data, String contentType) {
        String key = "photos/" + UUID.randomUUID();
        try {
            storage.put(key, data, contentType);
            return key;
        } catch (SdkException e) {
            log.warn("S3 upload failed, keeping the photo in the database: {}", e.getMessage());
            return null;
        }
    }

    private static byte[] bytes(MultipartFile file) {
        try {
            return file.getBytes();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private Photo photo(byte[] data, String contentType, String sellerId) {
        var photo = new Photo();
        photo.setContentType(contentType);
        photo.setStorageKey(useS3 ? putInS3(data, contentType) : null);
        if (photo.getStorageKey() == null) {
            photo.setData(data);
        }
        photo.setSellerId(sellerId);
        photo.setCreatedAt(Instant.now());
        return photo;
    }

    private static ResponseStatusException badRequest(String reason) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, reason);
    }
}
```

In `DraftController.java` delete the `getPhoto` method (it now lives in `PhotoController`; two mappings for the same path fail at startup). Leave the rest; Task 5 rewrites the class.

In `SecurityConfig.java` line 37 add `/api/photos`:

```java
                .requestMatchers(HttpMethod.POST, "/api/listings", "/api/listing-drafts", "/api/photos").authenticated()
```

In `DraftControllerTest.java` delete `unknownPhotoIsNotFound` (moved).

- [ ] **Step 4: Run, expect PASS**

Run: `cd backend && ./mvnw -q test -Dtest='PhotoControllerTest,DraftControllerTest'`

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/one/absent/hackaton/selling/PhotoController.java backend/src/main/java/one/absent/hackaton/selling/DraftController.java backend/src/main/java/one/absent/hackaton/config/SecurityConfig.java backend/src/test/java/one/absent/hackaton/selling/PhotoControllerTest.java backend/src/test/java/one/absent/hackaton/selling/DraftControllerTest.java
git commit -m "Add POST /api/photos so photos are stored once"
```

---

### Task 3: `AiClient.streamLines`

**Files:**
- Modify: `backend/src/main/java/one/absent/hackaton/ai/AiClient.java`
- Test: `backend/src/test/java/one/absent/hackaton/ai/AiClientTest.java`

- [ ] **Step 1: Write the failing tests** (append to `AiClientTest`, add imports `java.util.ArrayList`, `java.util.Map`)

```java
    static String sse(Object... events) {
        var mapper = JsonMapper.builder().build();
        var body = new StringBuilder();
        for (Object event : events) {
            body.append("event: x\ndata: ").append(mapper.writeValueAsString(event)).append("\n\n");
        }
        return body.toString();
    }

    static Map<String, Object> text(String text) {
        return Map.of("type", "content_block_delta", "delta", Map.of("type", "text_delta", "text", text));
    }

    static Map<String, Object> stop(String reason) {
        return Map.of("type", "message_delta", "delta", Map.of("stop_reason", reason));
    }

    @Test
    void streamsCompleteLinesAcrossChunks() {
        server.expect(requestTo("https://ai.test/v1/messages"))
                .andExpect(jsonPath("$.stream").value(true))
                .andExpect(jsonPath("$.tools").doesNotExist())
                .andExpect(jsonPath("$.output_config").doesNotExist())
                .andRespond(withSuccess(sse(Map.of("type", "message_start"), text("{\"a\":1}\n{\"b\""),
                        Map.of("type", "content_block_delta", "delta", Map.of("type", "thinking_delta", "thinking", "hm")),
                        text(":2}"), stop("end_turn")), MediaType.TEXT_EVENT_STREAM));

        List<String> lines = new ArrayList<>();
        client("test-key").streamLines("s", "t", List.of(), lines::add);

        assertThat(lines).containsExactly("{\"a\":1}", "{\"b\":2}");
        server.verify();
    }

    @Test
    void cutOffStreamFailsAfterTheLinesSoFar() {
        server.expect(requestTo("https://ai.test/v1/messages"))
                .andRespond(withSuccess(sse(text("{\"a\":1}\n{\"b\""), stop("max_tokens")), MediaType.TEXT_EVENT_STREAM));

        List<String> lines = new ArrayList<>();
        assertThatThrownBy(() -> client("test-key").streamLines("s", "t", List.of(), lines::add))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.BAD_GATEWAY));
        assertThat(lines).containsExactly("{\"a\":1}");
    }
```

In the cut-off case `streamLines` throws before handing over the incomplete remainder `{"b"`.

- [ ] **Step 2: Run, expect a compile failure** (`streamLines` missing)

Run: `cd backend && ./mvnw -q test -Dtest=AiClientTest`

- [ ] **Step 3: Implement**

In `AiClient.java` add imports:

```java
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.function.Consumer;
```

Change `request(...)` to take a `webSearch` flag and update both callers:

```java
    public <T> T ask(String model, String system, String text, List<Image> images, String schema, Class<T> type) {
        return send(request(model, system, text, images, schema, false), type);
    }

    public <T> T askWithWebSearch(String system, String text, Class<T> type) {
        return send(request(model, system, text, List.of(), null, true), type);
    }
```

```java
    private Map<String, Object> request(String model, String system, String text, List<Image> images, String schema,
                                        boolean webSearch) {
        // ... content list unchanged ...
        Map<String, Object> request = new HashMap<>();
        request.put("model", model);
        request.put("max_tokens", maxTokens);
        request.put("system", system);
        if (webSearch) {
            request.put("output_config", Map.of("effort", "low"));
            request.put("tools", List.of(Map.of("type", "web_search_20260209", "name", "web_search", "max_uses", 3,
                    "user_location", Map.of("type", "approximate", "country", "CH"))));
        } else if (schema != null) {
            request.put("output_config",
                    Map.of("format", Map.of("type", "json_schema", "schema", json.readTree(schema))));
        }
        // ... messages and fallbacks unchanged ...
    }
```

Add the streaming method after `askWithWebSearch`:

```java
    /**
     * Streams the answer and hands each complete, non-blank line to {@code onLine} as soon as it arrives.
     * For prompts that ask for JSON lines; structured output is not used since it is only valid when complete.
     */
    public void streamLines(String system, String text, List<Image> images, Consumer<String> onLine) {
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("AI call skipped: ai.api-key (ANTHROPIC_API_KEY) is not set");
            throw unavailable();
        }
        Map<String, Object> request = request(model, system, text, images, null, false);
        request.put("stream", true);
        try {
            http.post().uri("/v1/messages")
                    .header("x-api-key", apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(json.writeValueAsString(request))
                    .exchange((req, res) -> {
                        if (res.getStatusCode().isError()) {
                            log.warn("AI stream failed: {}", res.getStatusCode());
                            throw unavailable();
                        }
                        readLines(res.getBody(), onLine);
                        return null;
                    });
        } catch (RestClientException e) {
            log.warn("AI stream failed: {}", e.getMessage());
            throw unavailable();
        } catch (JacksonException e) {
            log.warn("AI stream is not the expected JSON: {}", e.getOriginalMessage());
            throw unusable();
        }
    }

    private void readLines(InputStream body, Consumer<String> onLine) throws IOException {
        var reader = new BufferedReader(new InputStreamReader(body, StandardCharsets.UTF_8));
        var pending = new StringBuilder();
        String stopReason = null;
        for (String sse; (sse = reader.readLine()) != null; ) {
            if (!sse.startsWith("data:")) {
                continue;
            }
            JsonNode event = json.readTree(sse.substring(5));
            switch (event.path("type").asString()) {
                case "content_block_delta" -> {
                    if ("text_delta".equals(event.path("delta").path("type").asString())) {
                        pending.append(event.path("delta").path("text").asString());
                        for (int nl; (nl = pending.indexOf("\n")) >= 0; ) {
                            emit(pending.substring(0, nl), onLine);
                            pending.delete(0, nl + 1);
                        }
                    }
                }
                case "message_delta" -> stopReason = event.path("delta").path("stop_reason").asString();
                case "error" -> {
                    log.warn("AI stream error: {}", event.path("error").path("message").asString());
                    throw unusable();
                }
                default -> {
                }
            }
        }
        if (!"end_turn".equals(stopReason)) {
            log.warn("AI stream unusable, stop_reason={}", stopReason);
            throw unusable();
        }
        emit(pending.toString(), onLine);
    }

    private static void emit(String line, Consumer<String> onLine) {
        if (!line.isBlank()) {
            onLine.accept(line.strip());
        }
    }
```

- [ ] **Step 4: Run, expect PASS** (all `AiClientTest` tests, the old ones too)

Run: `cd backend && ./mvnw -q test -Dtest=AiClientTest`

If `RestClient` wraps the `ResponseStatusException` thrown inside `exchange` in a `RestClientException`, the cut-off test fails with 503 instead of 502: then catch `ResponseStatusException` before `RestClientException` is reached by rethrowing it explicitly (`catch (ResponseStatusException e) { throw e; }` as the first catch).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/one/absent/hackaton/ai/AiClient.java backend/src/test/java/one/absent/hackaton/ai/AiClientTest.java
git commit -m "AiClient: stream an answer line by line"
```

---

### Task 4: `DraftEvent` and `DraftLines`

`DraftLines` turns AI lines into events. Pure logic, unit tested without Spring.

**Files:**
- Create: `backend/src/main/java/one/absent/hackaton/selling/DraftEvent.java`
- Create: `backend/src/main/java/one/absent/hackaton/selling/DraftLines.java`
- Modify: `backend/src/main/java/one/absent/hackaton/selling/ListingDraft.java` (drop `questions`)
- Test: `backend/src/test/java/one/absent/hackaton/selling/DraftLinesTest.java`

- [ ] **Step 1: Write the failing test**

```java
package one.absent.hackaton.selling;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;

import one.absent.hackaton.selling.DraftEvent.Type;
import one.absent.hackaton.selling.ListingDraft.PriceEstimate;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.json.JsonMapper;

class DraftLinesTest {
    final List<DraftEvent> events = new ArrayList<>();
    final DraftLines lines = new DraftLines(JsonMapper.builder().build(), 2, events::add);
    final PriceEstimator prices = mock(PriceEstimator.class);

    @Test void validLinesBecomeEventsAndTheDraftComesLast() {
        when(prices.estimate(any(), any(), any(), any())).thenReturn(mock(PriceEstimate.class));
        lines.accept("""
                {"type":"detection","photo":1,"box":[0.1,0.2,0.3,0.1],"label":"Brand: Trek","fact":{"name":"Brand","value":"Trek","source":"LABEL"}}""");
        lines.accept("""
                {"type":"privacy","photo":2,"box":[0.5,0.5,0.1,0.1],"text":"Shows a serial number."}""");
        lines.accept("""
                {"type":"gap","name":"Frame size","kind":"ASK","prompt":"What is the frame size?","options":["M","L"]}""");
        lines.accept("""
                {"type":"gap","name":"CPU","kind":"ASK","prompt":"Which CPU?","options":[]}""");
        lines.accept("""
                {"type":"gap","name":"Condition","kind":"PHOTO","prompt":"Photograph the whole bike","options":[]}""");
        lines.accept("""
                {"type":"draft","category":"Bikes","title":"Trek Marlin 7","description":"My bike.","condition":null,
                 "facts":[{"name":"Brand","value":"Trek","source":"LABEL"},{"name":"Brand","value":"x","source":"SELLER"}]}"""
                .replace("\n", ""));
        lines.finish(List.of(7L, 8L), prices);

        assertThat(events).extracting(DraftEvent::type)
                .containsExactly(Type.DETECTION, Type.PRIVACY, Type.GAP, Type.GAP, Type.DRAFT);
        assertThat(events.get(2).gap().fact()).isEqualTo("Frame size");
        assertThat(events.get(3).gap().fact()).isEqualTo("Condition");
        ListingDraft draft = events.get(4).draft();
        assertThat(draft.photoIds()).containsExactly(7L, 8L);
        assertThat(draft.facts()).hasSize(1); // SELLER source from the AI is dropped
        assertThat(draft.privacyWarnings()).containsExactly(new ListingDraft.PrivacyWarning(2, "Shows a serial number."));
    }

    @Test void invalidLinesAreDropped() {
        lines.accept("not json");
        lines.accept("{\"type\":\"detection\",\"photo\":3,\"box\":[0,0,1,1],\"label\":\"x\"}"); // only 2 photos
        lines.accept("{\"type\":\"detection\",\"photo\":1,\"box\":[0.5,0,0.6,1],\"label\":\"x\"}"); // box leaves the image
        lines.accept("{\"type\":\"detection\",\"photo\":1,\"box\":[0,0,1,1],\"label\":\"x\","
                + "\"fact\":{\"name\":\"Shoe size\",\"value\":\"42\",\"source\":\"LABEL\"}}");
        lines.accept("{\"type\":\"gap\",\"name\":\"Frame size\",\"kind\":\"GUESS\",\"prompt\":\"?\"}");
        lines.accept("{\"type\":\"chat\"}");

        assertThat(events).isEmpty();
    }

    @Test void noDraftLineIsAnError() {
        assertThatThrownBy(() -> lines.finish(List.of(7L), prices)).isInstanceOf(ResponseStatusException.class);
    }
}
```

- [ ] **Step 2: Run, expect a compile failure**

Run: `cd backend && ./mvnw -q test -Dtest=DraftLinesTest`

- [ ] **Step 3: Implement**

`ListingDraft.java`: remove the `questions` component:

```java
public record ListingDraft(List<Long> photoIds, String category, String title, String description,
                           @Schema(nullable = true) Condition condition, List<DraftFact> facts,
                           PriceEstimate price, List<PrivacyWarning> privacyWarnings) {
```

`DraftEvent.java`:

```java
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
```

`DraftLines.java`:

```java
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
    private final int photoCount;
    private final Consumer<DraftEvent> emit;
    private final List<Gap> gaps = new ArrayList<>();
    private final List<PrivacyWarning> privacy = new ArrayList<>();
    private AiLine draft;

    DraftLines(JsonMapper json, int photoCount, Consumer<DraftEvent> emit) {
        this.json = json;
        this.photoCount = photoCount;
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
                boolean ok = onImage(l) && l.label() != null && (l.fact() == null || factOk(l.fact()));
                if (ok) {
                    emit.accept(DraftEvent.of(new Detection(l.photo(), l.box(), l.label(), l.fact())));
                }
                yield ok;
            }
            case "privacy" -> {
                boolean ok = onImage(l) && l.text() != null;
                if (ok) {
                    privacy.add(new PrivacyWarning(l.photo(), l.text()));
                    emit.accept(DraftEvent.of(new PrivacyMark(l.photo(), l.box(), l.text())));
                }
                yield ok;
            }
            case "gap" -> {
                boolean ok = l.name() != null && l.kind() != null && l.prompt() != null
                        && (CONDITION.equals(l.name()) || Categories.FACT_NAMES.contains(l.name()));
                if (ok) {
                    gaps.add(new Gap(l.name(), l.kind(), l.prompt(), l.options() == null ? List.of() : l.options()));
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

    private boolean onImage(AiLine l) {
        List<Double> b = l.box();
        return l.photo() != null && l.photo() >= 1 && l.photo() <= photoCount
                && b != null && b.size() == 4 && b.stream().allMatch(v -> v != null && v >= 0 && v <= 1)
                && b.get(0) + b.get(2) <= 1.0001 && b.get(1) + b.get(3) <= 1.0001;
    }

    private static boolean factOk(DraftFact f) {
        return f.name() != null && Categories.FACT_NAMES.contains(f.name()) && f.value() != null
                && !f.value().isBlank() && (f.source() == FactSource.LABEL || f.source() == FactSource.SUGGESTION);
    }
}
```

The draft is built from the first valid `draft` line's facts with `factOk`, so the test's duplicate `Brand` with source `SELLER` is dropped.

`DraftController` still compiles against the old `ListingDraft` constructor (with `questions`); fix the call there by removing the `draft.questions(),` argument so the module compiles (Task 5 rewrites the class anyway), and remove the `.andExpect(jsonPath("$.questions[0])...` line from `DraftControllerTest`.

- [ ] **Step 4: Run, expect PASS**

Run: `cd backend && ./mvnw -q test -Dtest='DraftLinesTest,DraftControllerTest'`

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/one/absent/hackaton/selling/DraftEvent.java backend/src/main/java/one/absent/hackaton/selling/DraftLines.java backend/src/main/java/one/absent/hackaton/selling/ListingDraft.java backend/src/main/java/one/absent/hackaton/selling/DraftController.java backend/src/test/java/one/absent/hackaton/selling/DraftLinesTest.java backend/src/test/java/one/absent/hackaton/selling/DraftControllerTest.java
git commit -m "Validate streamed AI draft lines into draft events"
```

---

### Task 5: Stream endpoint `POST /api/listing-drafts/stream`

Replaces `POST /api/listing-drafts`.

**Files:**
- Rewrite: `backend/src/main/java/one/absent/hackaton/selling/DraftController.java`
- Modify: `backend/src/main/resources/application.yml` (under the existing top-level `spring:` key)
- Rewrite: `backend/src/test/java/one/absent/hackaton/selling/DraftControllerTest.java`

- [ ] **Step 1: Write the failing test** (whole file)

```java
package one.absent.hackaton.selling;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.doAnswer;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.time.Instant;
import java.util.List;
import java.util.function.Consumer;

import one.absent.hackaton.ai.AiClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class DraftControllerTest {
    static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 1, 2, 3};
    @Autowired WebApplicationContext context;
    @Autowired PhotoRepository photos;
    @MockitoBean AiClient ai;
    MockMvc mvc;

    @BeforeEach void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    long photoOf(String seller) {
        var photo = new Photo();
        photo.setContentType("image/png");
        photo.setData(PNG);
        photo.setSellerId(seller);
        photo.setCreatedAt(Instant.now());
        return photos.save(photo).getId();
    }

    void aiAnswers(String... lines) {
        doAnswer(inv -> {
            Consumer<String> onLine = inv.getArgument(3);
            for (String line : lines) {
                onLine.accept(line);
            }
            return null;
        }).when(ai).streamLines(anyString(), anyString(), anyList(), any());
    }

    String stream(String body) throws Exception {
        MvcResult started = mvc.perform(post("/api/listing-drafts/stream").with(jwt().jwt(j -> j.subject("seller")))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(request().asyncStarted())
                .andReturn();
        return mvc.perform(asyncDispatch(started))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Accel-Buffering", "no"))
                .andReturn().getResponse().getContentAsString();
    }

    @Test void streamsDetectionsGapsAndTheDraftAsEvents() throws Exception {
        long id = photoOf("seller");
        aiAnswers("""
                {"type":"detection","photo":1,"box":[0.1,0.1,0.2,0.2],"label":"Brand: Dell","fact":{"name":"Brand","value":"Dell","source":"LABEL"}}""",
                "{\"type\":\"gap\",\"name\":\"Size\",\"kind\":\"ASK\",\"prompt\":\"How big?\",\"options\":[\"24\\\"\",\"27\\\"\"]}",
                "garbage",
                "{\"type\":\"draft\",\"category\":\"Monitors\",\"title\":\"Dell U2719D\",\"description\":\"A monitor.\","
                        + "\"condition\":null,\"facts\":[{\"name\":\"Brand\",\"value\":\"Dell\",\"source\":\"LABEL\"}]}");

        String body = stream("{\"photoIds\":[%d],\"confirmedFacts\":[{\"name\":\"Size\",\"value\":\"27\\\"\"}]}"
                .formatted(id));

        assertThat(body.split("\n\n")).hasSize(3);
        assertThat(body).startsWith("data: {\"type\":\"DETECTION\"");
        assertThat(body).contains("\"type\":\"GAP\"", "\"type\":\"DRAFT\"", "\"photoIds\":[" + id + "]");
        ArgumentCaptor<String> text = ArgumentCaptor.forClass(String.class);
        org.mockito.Mockito.verify(ai).streamLines(anyString(), text.capture(), anyList(), any());
        assertThat(text.getValue()).contains("Size: 27\"");
    }

    @Test void aiFailureBecomesAnErrorEvent() throws Exception {
        long id = photoOf("seller");
        aiAnswers("{\"type\":\"detection\",\"photo\":1,\"box\":[0,0,1,1],\"label\":\"Monitor\"}");

        String body = stream("{\"photoIds\":[%d],\"confirmedFacts\":[]}".formatted(id));

        assertThat(body).contains("\"type\":\"DETECTION\"", "\"type\":\"ERROR\"",
                "\"detail\":\"AI gave no usable answer, please try again.\"");
    }

    @Test void foreignOrPublishedPhotosAreRejectedBeforeStreaming() throws Exception {
        long foreign = photoOf("someone else");
        mvc.perform(post("/api/listing-drafts/stream").with(jwt().jwt(j -> j.subject("seller")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"photoIds\":[%d],\"confirmedFacts\":[]}".formatted(foreign)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Unknown photo."));
    }

    @Test void needsOneToFivePhotos() throws Exception {
        mvc.perform(post("/api/listing-drafts/stream").with(jwt().jwt(j -> j.subject("seller")))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"photoIds\":[],\"confirmedFacts\":[]}"))
                .andExpect(status().isBadRequest());
    }

    @Test void streamRequiresAuthentication() throws Exception {
        mvc.perform(post("/api/listing-drafts/stream").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"photoIds\":[1],\"confirmedFacts\":[]}"))
                .andExpect(status().isUnauthorized());
    }

    @Test void shortTitleCutsAtAWordBoundary() {
        String title = "Apple iMac 27 inch Retina 5K 2017 with Intel Core i5 and 16 GB RAM and 1 TB Fusion Drive";
        String cut = DraftController.shortTitle(title);
        assertThat(cut.length()).isLessThanOrEqualTo(60);
        assertThat(title).startsWith(cut + " ");
        assertThat(DraftController.shortTitle("Dell U2719D")).isEqualTo("Dell U2719D");
    }
}
```

The old end-to-end test (upload → draft → publish → photo reuse rejected) is covered by `PhotoControllerTest` (upload/serve) and `SellingControllerTest` (publish); check that `SellingControllerTest` asserts a published photo cannot be reused, and if not, move those last two requests of the old test there.

- [ ] **Step 2: Run, expect FAIL** (404 on the stream path)

Run: `cd backend && ./mvnw -q test -Dtest=DraftControllerTest`

- [ ] **Step 3: Implement**

`application.yml`, add under the existing `spring:` key (Tomcat's 30 s default is too short for an AI stream):

```yaml
  mvc:
    async:
      request-timeout: 150s
```

`DraftController.java` (whole file):

```java
package one.absent.hackaton.selling;

import java.io.IOException;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.stream.Collectors;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import one.absent.hackaton.ai.AiClient;
import one.absent.hackaton.listing.Categories;
import one.absent.hackaton.photo.PhotoStorage;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;
import tools.jackson.databind.json.JsonMapper;

/** Streams a listing draft from the seller's uploaded photos as server-sent events. */
@Tag(name = "Selling")
@RestController
public class DraftController {

    static final String SYSTEM = """
            You prepare a listing draft for a Swiss secondhand marketplace from the seller's photos.
            Answer only with JSON lines: one complete JSON object per line, no other text, no code fences.
            Write the lines in this order:
            1. One "detection" line per thing you recognise, most telling first, e.g.
               {"type":"detection","photo":1,"box":[0.12,0.40,0.30,0.08],"label":"Brand: Trek","fact":{"name":"Brand","value":"Trek","source":"LABEL"}}
               photo is the 1-based photo position. box is x, y (top-left corner), width, height as fractions
               from 0 to 1 of the image. fact only when the detection gives one.
            2. One "privacy" line per area that shows a serial number, IMEI, MAC address, a person's name, address,
               phone number, a document, an employee or asset tag, or a screen with personal content, e.g.
               {"type":"privacy","photo":2,"box":[0.5,0.6,0.2,0.05],"text":"Shows a serial number. Leave this photo out or cover it."}
               Never repeat the value.
            3. One "gap" line per key fact of the category that is not readable on a label and not confirmed by the
               seller, and one named "Condition" when condition is null, e.g.
               {"type":"gap","name":"Frame size","kind":"ASK","prompt":"What is the frame size?","options":["S","M","L","XL"]}
               kind: PHOTO when a photo would show it (the prompt says exactly what to photograph, e.g.
               "Please photograph the type plate on the back"), CONFIRM when you suggested a value, otherwise ASK.
               options: 2 to 6 short typical answers for this very item, or [] when free text fits better.
               Identity first: Brand and Model, then Condition, then the rest.
            4. Last, exactly one "draft" line:
               {"type":"draft","category":"Bikes","title":"...","description":"...","condition":null,"facts":[...]}
            Rules:
            - facts: only text you can read on a label, type plate, screen or datasheet gets source LABEL.
              Everything you infer from appearance gets source SUGGESTION. Never use any other source.
            - Never invent internal specs (CPU, RAM, storage, ...) unless they are readable on a label or screen.
              Never claim working condition, ownership or included accessories.
            - Fact names only from the allowed list; values short and normalized (e.g. 27", 16 GB, 2560x1440).
              One fact per name at most; leave out what you cannot see. Facts the seller confirmed are final.
            - title: at most 60 characters, brand + model + one distinguishing variant (size or year).
              No CPU, RAM, storage or part numbers in the title; those belong in facts.
            - description: written as the seller, first person, 2 to 3 sentences: what it is, known model
              details, visible wear. Never mention photos, pictures, images or labels ("The photo shows..." is
              wrong). Never claim it works, is complete, or includes accessories. No marketing language.
            - condition: null unless the photos clearly show the outside of the whole item. Label close-ups,
              partial views and blurry photos give null. Absence of visible wear in a partial view is not evidence.
              Otherwise NEW, LIKE_NEW, GOOD, USED or DEFECTIVE from visible wear.
            - Never copy serial numbers or personal data into any line.
            - category: the best fit from the allowed list.
            Allowed categories: %s
            Allowed fact names: %s
            Key facts per category:
            %s
            """.formatted(Categories.JSON, String.join(", ", Categories.FACT_NAMES),
            Categories.ALL.stream().map(c -> c + ": " + String.join(", ", Categories.KEY_FACTS.get(c)))
                    .collect(Collectors.joining("\n")));

    public record ConfirmedFact(@NotBlank @Size(max = 100) String name, @NotBlank @Size(max = 500) String value) {}

    /** {@code confirmedFacts} are the seller's own facts; the AI keeps them and does not ask again. */
    public record DraftRequest(@NotNull @Size(min = 1, max = 5) List<Long> photoIds,
                               @NotNull List<@Valid ConfirmedFact> confirmedFacts) {}

    private final PhotoRepository photos;
    private final PhotoStorage storage;
    private final AiClient ai;
    private final PriceEstimator prices;
    private final JsonMapper json;

    public DraftController(PhotoRepository photos, PhotoStorage storage, AiClient ai, PriceEstimator prices,
                           JsonMapper json) {
        this.photos = photos;
        this.storage = storage;
        this.ai = ai;
        this.prices = prices;
        this.json = json;
    }

    @Operation(responses = @ApiResponse(responseCode = "200", description = "One `data:` line per DraftEvent",
            content = @Content(mediaType = MediaType.TEXT_EVENT_STREAM_VALUE,
                    schema = @Schema(implementation = DraftEvent.class))))
    @PostMapping(value = "/api/listing-drafts/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<StreamingResponseBody> streamDraft(@Valid @RequestBody DraftRequest request,
                                                             @AuthenticationPrincipal Jwt seller) {
        List<AiClient.Image> images = imagesOf(request.photoIds(), seller.getSubject());
        String text = "Create the listing draft for the item in these photos." + (request.confirmedFacts().isEmpty()
                ? "" : "\nThe seller confirmed:\n" + request.confirmedFacts().stream()
                        .map(f -> f.name() + ": " + f.value()).collect(Collectors.joining("\n")));
        StreamingResponseBody body = out -> {
            Consumer<DraftEvent> emit = event -> write(out, event);
            try {
                var lines = new DraftLines(json, images.size(), emit);
                ai.streamLines(SYSTEM, text, images, lines);
                lines.finish(request.photoIds(), prices);
            } catch (ResponseStatusException e) {
                emit.accept(DraftEvent.error(e.getReason()));
            }
        };
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noCache())
                // keeps a reverse proxy from buffering the stream
                .header("X-Accel-Buffering", "no")
                .contentType(MediaType.TEXT_EVENT_STREAM)
                .body(body);
    }

    /** The images of the seller's unpublished photos, in request order. */
    private List<AiClient.Image> imagesOf(List<Long> ids, String sellerId) {
        Map<Long, Photo> found = photos.findAllById(ids).stream()
                .collect(Collectors.toMap(Photo::getId, Function.identity()));
        return ids.stream().map(id -> {
            Photo photo = found.get(id);
            if (photo == null || !photo.getSellerId().equals(sellerId) || photo.getListingId() != null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown photo.");
            }
            byte[] data = photo.getStorageKey() == null ? photo.getData() : storage.get(photo.getStorageKey()).bytes();
            return new AiClient.Image(data, photo.getContentType());
        }).toList();
    }

    private void write(OutputStream out, DraftEvent event) {
        try {
            out.write(("data: " + json.writeValueAsString(event) + "\n\n").getBytes(StandardCharsets.UTF_8));
            out.flush();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    // shortcut: hard cut, the prompt does the real work
    static String shortTitle(String title) {
        if (title.length() <= 60) {
            return title;
        }
        int space = title.lastIndexOf(' ', 60);
        return title.substring(0, space > 0 ? space : 60).strip();
    }
}
```

In `SecurityConfig.java` line 37, remove the now unused `"/api/listing-drafts"` (line 38 `"/api/listing-drafts/**"` covers the stream):

```java
                .requestMatchers(HttpMethod.POST, "/api/listings", "/api/photos").authenticated()
```

- [ ] **Step 4: Run all backend tests, expect PASS**

Run: `cd backend && ./mvnw -q verify`

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/one/absent/hackaton/selling/DraftController.java backend/src/main/java/one/absent/hackaton/config/SecurityConfig.java backend/src/main/resources/application.yml backend/src/test/java/one/absent/hackaton/selling/DraftControllerTest.java
git commit -m "Stream listing drafts as server-sent events"
```

---

### Task 6: Regenerate the API client and note the exception

**Files:**
- Modify: `frontend/openapi.json`, `frontend/src/app/api/**` (generated)
- Modify: `AGENTS.md` (rule "The frontend calls the backend only through the generated client")

- [ ] **Step 1: Regenerate**

```bash
cd backend && ./mvnw -q verify -DskipTests
```

```bash
cd frontend && pnpm run api
```

Check: `grep -rl "DraftEvent\|CategoryInfo\|uploadPhotos" frontend/src/app/api` lists the new models and services. `DraftEvent` reaches `components.schemas` only through the `@ApiResponse` content schema on `streamDraft`; if it is missing, that annotation is not picked up.

- [ ] **Step 2: Note the exception in `AGENTS.md`** — append to the generated-client rule:

```markdown
  Only exception: the draft stream (`POST /api/listing-drafts/stream`, server-sent events) is read by
  `frontend/src/app/draft-stream.ts` with `fetch`, because the generator cannot read a stream. Its event
  types still come from the generated models.
```

- [ ] **Step 3: Commit**

```bash
git add frontend/openapi.json frontend/src/app/api AGENTS.md
git commit -m "Regenerate API client for photo upload, categories and draft stream"
```

---

### Task 7: `DraftStream` — the hand-written stream reader

**Files:**
- Create: `frontend/src/app/draft-stream.ts`
- Test: `frontend/src/app/draft-stream.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { TestBed } from '@angular/core/testing';
import { Auth } from './auth/auth';
import { DraftEvent } from './api/models';
import { DraftStream } from './draft-stream';

function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      chunks.forEach((c) => controller.enqueue(encoder.encode(c)));
      controller.close();
    },
  });
}

describe('DraftStream', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: Auth, useValue: { token: () => Promise.resolve('jwt') } }],
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('sends the token and parses events split across chunks', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        streamOf(
          'data: {"type":"DETECTION","detection":{"photo":1,"box":[0,0,1,1],"label":"Dell"}}\n\ndata: {"ty',
          'pe":"ERROR","detail":"x"}\n\n',
        ),
      ),
    );
    vi.stubGlobal('fetch', fetch);
    const events: DraftEvent[] = [];

    await TestBed.inject(DraftStream).run({ photoIds: [1], confirmedFacts: [] }, (e) => events.push(e));

    expect(events.map((e) => e.type)).toEqual(['DETECTION', 'ERROR']);
    expect(fetch.mock.calls[0][0]).toBe('/api/listing-drafts/stream');
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer jwt');
  });

  it('rejects with the problem detail', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: 'Unknown photo.' }), { status: 400 }),
      ),
    );

    await expect(
      TestBed.inject(DraftStream).run({ photoIds: [1], confirmedFacts: [] }, () => {}),
    ).rejects.toThrow('Unknown photo.');
  });
});
```

- [ ] **Step 2: Run, expect FAIL** (module missing)

Run: `cd frontend && pnpm exec ng test --watch=false --include=src/app/draft-stream.spec.ts`

- [ ] **Step 3: Implement**

```ts
import { Injectable, inject } from '@angular/core';
import { DraftEvent, DraftRequest } from './api/models';
import { Auth } from './auth/auth';
import { Problem } from './errors';

/**
 * Reads the draft stream (server-sent events). The one hand-written API call: the generated client
 * cannot read a stream. Resolves when the stream ends, rejects with the server's message.
 */
// shortcut: a 401 here shows the message instead of redirecting to login like authInterceptor; upgrade if sessions expire mid-sell
@Injectable({ providedIn: 'root' })
export class DraftStream {
  private readonly auth = inject(Auth);

  async run(body: DraftRequest, onEvent: (event: DraftEvent) => void): Promise<void> {
    const token = await this.auth.token();
    const response = await fetch('/api/listing-drafts/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!response.ok || !response.body) {
      const problem = (await response.json().catch(() => ({}))) as Problem;
      throw new Error(problem.detail ?? 'The draft could not be created.');
    }
    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return;
      buffer += value;
      const events = buffer.split('\n\n');
      buffer = events.pop()!;
      for (const event of events) {
        if (event.startsWith('data: ')) onEvent(JSON.parse(event.slice(6)) as DraftEvent);
      }
    }
  }
}
```

If the generated request model has another name than `DraftRequest` (check `frontend/src/app/api/models.ts`), use that name in both files.

- [ ] **Step 4: Run, expect PASS**

Run: `cd frontend && pnpm exec ng test --watch=false --include=src/app/draft-stream.spec.ts`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/draft-stream.ts frontend/src/app/draft-stream.spec.ts
git commit -m "Read the draft stream in the frontend"
```

---

### Task 8: Gap computation

**Files:**
- Create: `frontend/src/app/gaps.ts`
- Test: `frontend/src/app/gaps.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { Gap } from './api/models';
import { CONDITION, completeness, openGaps } from './gaps';

const BIKE = ['Brand', 'Model', 'Frame size', 'Wheel size', 'Gears', 'Brakes'];
const AI: Gap[] = [
  { fact: 'Model', kind: 'PHOTO', prompt: 'Photograph the model lettering', options: [] },
  { fact: 'Frame size', kind: 'ASK', prompt: 'What frame size?', options: ['M', 'L'] },
];

describe('openGaps', () => {
  it('asks identity first, then condition, then the rest, at most five', () => {
    const cards = openGaps(BIKE, [{ name: 'Brand', value: 'Trek', source: 'LABEL' }], '', AI, new Set());

    expect(cards.map((c) => c.fact)).toEqual(['Model', CONDITION, 'Frame size', 'Wheel size', 'Gears']);
    expect(cards[0]).toMatchObject({ kind: 'PHOTO', prompt: 'Photograph the model lettering' });
    expect(cards[1].kind).toBe('PHOTO');
    expect(cards[2].options).toEqual(['M', 'L']);
    expect(cards[3]).toMatchObject({ kind: 'ASK', prompt: 'Wheel size?', options: [] });
  });

  it('turns a suggestion into a confirm card and drops confirmed and skipped facts', () => {
    const cards = openGaps(
      BIKE,
      [
        { name: 'Brand', value: 'Trek', source: 'SELLER' },
        { name: 'Model', value: 'Marlin 7', source: 'SUGGESTION' },
      ],
      'GOOD',
      AI,
      new Set(['Frame size', 'Wheel size', 'Gears']),
    );

    expect(cards).toEqual([
      { fact: 'Model', kind: 'CONFIRM', prompt: 'Model: Marlin 7?', options: [], value: 'Marlin 7' },
      { fact: 'Brakes', kind: 'ASK', prompt: 'Brakes?', options: [] },
    ]);
  });
});

describe('completeness', () => {
  it('counts confirmed key facts', () => {
    expect(
      completeness(BIKE, [
        { name: 'Brand', value: 'Trek', source: 'LABEL' },
        { name: 'Model', value: 'x', source: 'SUGGESTION' },
        { name: 'Gears', value: '12', source: 'SELLER' },
      ]),
    ).toBe(2 / 6);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `cd frontend && pnpm exec ng test --watch=false --include=src/app/gaps.spec.ts`

- [ ] **Step 3: Implement**

```ts
import { Gap } from './api/models';

/** Not a fact, but asked for like one. */
export const CONDITION = 'Condition';
export const MAX_CARDS = 5;

export interface KnownFact {
  name: string;
  value: string;
  source: 'LABEL' | 'SELLER' | 'SUGGESTION' | 'WEB';
}

export interface GapCard {
  fact: string;
  kind: NonNullable<Gap['kind']>;
  prompt: string;
  options: string[];
  /** the suggested value of a CONFIRM card */
  value?: string;
}

const confirmed = (fact: KnownFact | undefined) =>
  !!fact?.value.trim() && (fact.source === 'LABEL' || fact.source === 'SELLER');

/**
 * The cards the seller still has to answer: key facts that are missing or only suggested, and the
 * condition when it is unknown. Brand and Model first, then condition, then catalog order.
 */
export function openGaps(
  keyFacts: string[],
  facts: KnownFact[],
  condition: string,
  aiGaps: Gap[],
  skipped: ReadonlySet<string>,
): GapCard[] {
  const identity = keyFacts.filter((name) => name === 'Brand' || name === 'Model');
  const rest = keyFacts.filter((name) => !identity.includes(name));
  const cards: GapCard[] = [];
  for (const name of [...identity, CONDITION, ...rest]) {
    if (skipped.has(name)) continue;
    const ai = aiGaps.find((gap) => gap.fact === name);
    if (name === CONDITION) {
      if (!condition)
        cards.push({
          fact: name,
          kind: 'PHOTO',
          prompt: ai?.prompt ?? 'Please photograph the whole item so its condition is visible',
          options: [],
        });
      continue;
    }
    const fact = facts.find((f) => f.name === name);
    if (confirmed(fact)) continue;
    if (fact?.value.trim()) {
      cards.push({
        fact: name,
        kind: 'CONFIRM',
        prompt: `${name}: ${fact.value}?`,
        options: [],
        value: fact.value,
      });
    } else {
      const kind = ai?.kind && ai.kind !== 'CONFIRM' ? ai.kind : 'ASK';
      cards.push({ fact: name, kind, prompt: ai?.prompt ?? `${name}?`, options: ai?.options ?? [] });
    }
  }
  return cards.slice(0, MAX_CARDS);
}

/** Share of the category's key facts that come from a label or the seller. */
export function completeness(keyFacts: string[], facts: KnownFact[]): number {
  if (!keyFacts.length) return 1;
  return keyFacts.filter((name) => confirmed(facts.find((f) => f.name === name))).length / keyFacts.length;
}
```

- [ ] **Step 4: Run, expect PASS**

Run: `cd frontend && pnpm exec ng test --watch=false --include=src/app/gaps.spec.ts`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/gaps.ts frontend/src/app/gaps.spec.ts
git commit -m "Compute the sell flow's open gaps"
```

---

### Task 9: Sell page state machine

Functional markup only; the visual design comes later from Claude Design. Keep the existing Tailwind classes and `styles` block; new elements get plain utility classes.

**Files:**
- Rewrite: `frontend/src/app/pages/sell.ts`
- Rewrite: `frontend/src/app/pages/sell.spec.ts`

- [ ] **Step 1: Write the failing tests** (whole `sell.spec.ts`)

```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ListingsService, SellingService } from '../api/services';
import { DraftEvent, ListingDraft } from '../api/models';
import { DraftStream } from '../draft-stream';
import { ErrorBanner } from '../errors';
import { Sell } from './sell';

const DRAFT: ListingDraft = {
  photoIds: [7],
  category: 'Monitors',
  title: 'Dell U2719D',
  description: 'A monitor.',
  condition: 'GOOD',
  facts: [
    { name: 'Brand', value: 'Dell', source: 'LABEL' },
    { name: 'Size', value: '27"', source: 'SUGGESTION' },
  ],
  price: { lowChf: 100, midChf: 120, highChf: 140, provisional: true, evidence: [] },
  privacyWarnings: [],
};
const CATEGORIES = [{ name: 'Monitors', keyFacts: ['Brand', 'Model', 'Size', 'Resolution'] }];

const detection = (label: string): DraftEvent => ({
  type: 'DETECTION',
  detection: { photo: 1, box: [0.1, 0.1, 0.2, 0.2], label },
});
const done = (draft: ListingDraft): DraftEvent => ({ type: 'DRAFT', draft });

type Run = (body: unknown, onEvent: (e: DraftEvent) => void) => Promise<void>;

/** Opens the sell page, adds one photo and runs the analysis with the given stream behaviour. */
async function analyse(runs: Run[], extra: object = {}) {
  URL.createObjectURL = vi.fn().mockReturnValue('blob:photo');
  const uploadPhotos = vi.fn().mockReturnValue(of([7]));
  const run = vi.fn();
  runs.forEach((r) => run.mockImplementationOnce(r));
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: SellingService, useValue: { uploadPhotos, ...extra } },
      { provide: ListingsService, useValue: { categories: () => of(CATEGORIES) } },
      { provide: DraftStream, useValue: { run } },
    ],
  });
  const fixture = TestBed.createComponent(Sell);
  const element = fixture.nativeElement as HTMLElement;
  await fixture.whenStable();
  const input = element.querySelector<HTMLInputElement>('input[multiple]')!;
  Object.defineProperty(input, 'files', {
    value: [new File(['x'], 'item.png', { type: 'image/png' })],
  });
  input.dispatchEvent(new Event('change'));
  await fixture.whenStable();
  button(element, 'Analyse').click();
  await fixture.whenStable();
  return { fixture, element, uploadPhotos, run };
}

const streams = (...events: DraftEvent[]): Run => async (_body, onEvent) => events.forEach(onEvent);

function button(element: HTMLElement, text: string): HTMLButtonElement {
  return Array.from(element.querySelectorAll('button')).find((b) =>
    b.textContent!.includes(text),
  )!;
}

/** Runs the analysis and skips straight to the review form. */
async function review(draft: ListingDraft, extra: object = {}) {
  const page = await analyse([streams(done(draft))], extra);
  button(page.element, 'To overview')?.click();
  await page.fixture.whenStable();
  return page;
}

describe('Sell', () => {
  it('uploads once, marks detections on the photo and starts with the identity gap', async () => {
    const { element, uploadPhotos, run } = await analyse([
      streams(detection('Brand: Dell'), done(DRAFT)),
    ]);

    expect(uploadPhotos).toHaveBeenCalledOnce();
    expect(run.mock.calls[0][0]).toEqual({ photoIds: [7], confirmedFacts: [] });
    expect(element.querySelector('[data-testid="detection"]')!.textContent).toContain('Brand: Dell');
    expect(element.querySelector('[data-testid="gap"]')!.textContent).toContain('Model?');
    expect(element.textContent).toContain('1 of 3');
  });

  it('answers, confirms and skips gaps, then publishes the confirmed facts', async () => {
    const publish = vi.fn().mockReturnValue(of({ id: 3 }));
    const { fixture, element } = await analyse([streams(done(DRAFT))], { publish });

    const answer = element.querySelector<HTMLInputElement>('[data-testid="gap"] input')!;
    answer.value = 'U2719D';
    answer.dispatchEvent(new Event('input'));
    button(element, 'Save').click();
    await fixture.whenStable();
    expect(element.querySelector('[data-testid="gap"]')!.textContent).toContain('Size: 27"?');

    button(element, 'Correct').click();
    await fixture.whenStable();
    button(element, 'Skip').click();
    await fixture.whenStable();

    expect(element.querySelector('[data-testid="gap"]')).toBeNull();
    expect(element.textContent).toContain('Still open: Resolution');
    expect(
      fixture.componentInstance['facts']().map((f: { name: string; source: string }) => [
        f.name,
        f.source,
      ]),
    ).toEqual([
      ['Model', 'SELLER'],
      ['Brand', 'LABEL'],
      ['Size', 'SELLER'],
    ]);
  });

  it('a photo gap uploads only the new photo and streams again with the confirmed facts', async () => {
    const photoGap: DraftEvent = {
      type: 'GAP',
      gap: { fact: 'Model', kind: 'PHOTO', prompt: 'Photograph the label', options: [] },
    };
    const { fixture, element, uploadPhotos, run } = await analyse([
      streams(photoGap, done(DRAFT)),
      streams(done({ ...DRAFT, photoIds: [7, 8] })),
    ]);
    uploadPhotos.mockReturnValue(of([8]));
    expect(element.querySelector('[data-testid="gap"]')!.textContent).toContain('Photograph the label');

    const input = element.querySelector<HTMLInputElement>('[data-testid="gap"] input[type="file"]')!;
    Object.defineProperty(input, 'files', {
      value: [new File(['y'], 'label.png', { type: 'image/png' })],
    });
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(uploadPhotos).toHaveBeenCalledTimes(2);
    expect(uploadPhotos.mock.calls[1][0].body.photos).toHaveLength(1);
    expect(run.mock.calls[1][0].photoIds).toEqual([7, 8]);
  });

  it('offers to analyse again when the stream fails before the draft', async () => {
    const { fixture, element, uploadPhotos, run } = await analyse([
      async (_b, onEvent) => {
        onEvent(detection('Monitor'));
        onEvent({ type: 'ERROR', detail: 'AI is not available right now.' });
      },
      streams(done(DRAFT)),
    ]);

    expect(TestBed.inject(ErrorBanner).message()).toBe('AI is not available right now.');
    button(element, 'Analyse again').click();
    await fixture.whenStable();

    expect(uploadPhotos).toHaveBeenCalledOnce();
    expect(run).toHaveBeenCalledTimes(2);
    expect(element.querySelector('[data-testid="gap"]')).not.toBeNull();
  });

  it('marks facts by source in the review and confirms a suggestion', async () => {
    const { fixture, element } = await review(DRAFT);
    const markers = () =>
      Array.from(element.querySelectorAll('[data-testid="marker"]')).map((m) =>
        m.textContent!.trim(),
      );
    expect(markers()).toEqual(['From label', 'Suggested — please check']);
    expect(element.textContent).toContain('Provisional estimate');

    element.querySelector<HTMLInputElement>('[data-testid="fact"] input[type="checkbox"]')!.click();
    await fixture.whenStable();
    expect(markers()).toEqual(['From label', 'Confirmed by you']);
  });

  it("asks the seller to choose the condition when the photos don't show it", async () => {
    const { element } = await review({ ...DRAFT, condition: null });

    expect(element.querySelector<HTMLSelectElement>('select[name="condition"]')!.value).toBe('');
    expect(element.textContent).toContain(
      "The photos don't show the condition — please choose it.",
    );
  });

  it('warns about private details and leaves the photo out', async () => {
    const { fixture, element } = await review({
      ...DRAFT,
      photoIds: [7, 8],
      privacyWarnings: [{ photo: 1, text: 'Shows a serial number.' }],
    });

    expect(element.querySelector('[aria-label="Privacy check"]')!.textContent).toContain(
      'Photo 1: Shows a serial number.',
    );
    element.querySelector<HTMLInputElement>('[aria-label="Privacy check"] input')!.click();
    await fixture.whenStable();
    expect(fixture.componentInstance['photoIdsToPublish']()).toEqual([8]);
  });

  it('completes technical data from the web', async () => {
    const completeFacts = vi.fn().mockReturnValue(
      of([
        {
          name: 'Resolution',
          value: '5120x2880',
          source: 'WEB',
          sourceUrl: 'https://example.com/specs',
        },
      ]),
    );
    const { fixture, element } = await review(
      { ...DRAFT, facts: [{ name: 'Model', value: 'iMac18,3', source: 'LABEL' }] },
      { completeFacts },
    );

    button(element, 'Complete technical data').click();
    await fixture.whenStable();

    expect(completeFacts.mock.calls[0][0].body.facts).toEqual([
      { name: 'Model', value: 'iMac18,3', source: 'LABEL' },
    ]);
    expect(element.textContent).toContain('From the web — please check');
    expect(
      element.querySelector<HTMLAnchorElement>('a[href="https://example.com/specs"]')!.textContent,
    ).toContain('Source');
  });

  it('labels every fact input', async () => {
    const { element } = await review(DRAFT);

    const inputs = element.querySelectorAll<HTMLInputElement>(
      '[data-testid="fact"] input:not([type=checkbox])',
    );
    expect(inputs.length).toBe(2);
    for (const input of Array.from(inputs)) {
      expect(element.querySelector(`label[for="${input.id}"]`)).not.toBeNull();
    }
  });
});
```

With `DRAFT` (Monitors, Brand from the label, Size suggested, condition `GOOD`) the cards are Model (ASK) → Size (CONFIRM) → Resolution (ASK): "1 of 3". Answering prepends the new Model fact; confirming replaces Size in place.

- [ ] **Step 2: Run, expect FAIL**

Run: `cd frontend && pnpm exec ng test --watch=false --include=src/app/pages/sell.spec.ts`

- [ ] **Step 3: Implement** — `sell.ts` (whole file)

```ts
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { ListingsService, SellingService } from '../api/services';
import {
  CreateListingRequest,
  Detection,
  DraftEvent,
  Gap,
  ListingDraft,
  PrivacyMark,
} from '../api/models';
import { PricePanel } from '../components/price-panel';
import { DraftStream } from '../draft-stream';
import { ErrorBanner } from '../errors';
import { CONDITION, GapCard, KnownFact, completeness, openGaps } from '../gaps';

type Source = KnownFact['source'];
type Condition = CreateListingRequest['condition'];
type Field = 'title' | 'category' | 'condition' | 'description';
type Step = 'PHOTOS' | 'ANALYZING' | 'GAPS' | 'REVIEW';
interface Fact extends KnownFact {
  sourceUrl?: string | null;
}
interface SellPhoto {
  file: File;
  url: string;
  id?: number;
}

const MAX_PHOTOS = 5;
const MARKERS: Record<Source, string> = {
  LABEL: 'From label',
  SUGGESTION: 'Suggested — please check',
  SELLER: 'Confirmed by you',
  WEB: 'From the web — please check',
};
const MARKER_STYLES: Record<Source, string> = {
  LABEL: 'bg-sky-100 text-sky-900',
  SUGGESTION: 'bg-amber-100 text-amber-900',
  SELLER: 'bg-emerald-100 text-emerald-900',
  WEB: 'bg-violet-100 text-violet-900',
};

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-sell',
  imports: [PricePanel],
  styles: `
    label {
      display: grid;
      gap: 0.25rem;
      font-weight: 600;
    }
    input:not([type='checkbox']):not([type='file']),
    textarea,
    select {
      border: 1px solid #94a3b8;
      border-radius: 0.375rem;
      padding: 0.75rem;
      font-weight: 400;
      background: white;
    }
    .primary {
      background: #115e59;
      color: white;
      padding: 0.75rem;
      border-radius: 0.375rem;
      cursor: pointer;
    }
    .secondary {
      border: 1px solid #115e59;
      color: #115e59;
      padding: 0.5rem 0.75rem;
      border-radius: 0.375rem;
      cursor: pointer;
    }
    .secondary[aria-pressed='true'] {
      background: #115e59;
      color: white;
    }
    button:disabled {
      opacity: 0.5;
      cursor: default;
    }
  `,
  template: `
    <h1 class="text-2xl font-semibold">Sell an item</h1>

    @if (view() === 'PHOTOS') {
      <p class="mt-1">Add 1 to 5 photos. Include the type plate or model label if there is one.</p>
      <div class="mt-4 grid max-w-lg gap-3">
        <div class="flex flex-wrap gap-2">
          <label class="secondary"
            >Take photo
            <input
              type="file"
              accept="image/*"
              capture="environment"
              class="sr-only"
              [disabled]="photos().length >= maxPhotos"
              (change)="addPhotos($any($event.target))"
          /></label>
          <label class="secondary"
            >Choose photos
            <input
              type="file"
              accept="image/*"
              multiple
              class="sr-only"
              [disabled]="photos().length >= maxPhotos"
              (change)="addPhotos($any($event.target))"
          /></label>
        </div>
        <ul class="flex flex-wrap gap-2" aria-label="Selected photos">
          @for (photo of photos(); track photo.url; let i = $index) {
            <li class="relative">
              <img [src]="photo.url" [alt]="'Photo ' + (i + 1)" class="h-24 w-24 rounded object-cover" />
              <button
                type="button"
                class="absolute top-1 right-1 rounded bg-white/90 px-1 text-sm"
                [attr.aria-label]="'Remove photo ' + (i + 1)"
                (click)="removePhoto(i)"
              >
                ✕
              </button>
            </li>
          }
        </ul>
        <button type="button" class="primary" [disabled]="!photos().length || busy()" (click)="analyse()">
          {{ busy() ? 'Uploading…' : 'Analyse' }}
        </button>
      </div>
    } @else {
      <section class="mt-4 grid max-w-lg gap-2" aria-label="Detections">
        @if (photos()[shownPhoto()]; as photo) {
          <div class="relative">
            <img [src]="photo.url" [alt]="'Photo ' + (shownPhoto() + 1)" class="w-full rounded" />
            @for (mark of marksOn(shownPhoto() + 1); track $index) {
              <div
                class="absolute border-2"
                [class]="mark.privacy ? 'border-rose-500' : 'border-teal-500'"
                [style.left.%]="mark.box[0] * 100"
                [style.top.%]="mark.box[1] * 100"
                [style.width.%]="mark.box[2] * 100"
                [style.height.%]="mark.box[3] * 100"
                [attr.data-testid]="mark.privacy ? 'privacy' : 'detection'"
              >
                <span class="absolute -top-6 left-0 rounded bg-white/90 px-1 text-sm whitespace-nowrap">{{
                  mark.label
                }}</span>
              </div>
            }
          </div>
        }
        <ul class="flex flex-wrap gap-2" aria-label="Photos">
          @for (photo of photos(); track photo.url; let i = $index) {
            <li>
              <button type="button" (click)="shownPhoto.set(i)" [attr.aria-pressed]="shownPhoto() === i">
                <img
                  [src]="photo.url"
                  [alt]="'Photo ' + (i + 1) + (excluded().has(i) ? ' (left out)' : '')"
                  class="h-16 w-16 rounded object-cover"
                  [class]="excluded().has(i) ? 'opacity-40 ring-2 ring-rose-500' : ''"
                />
              </button>
            </li>
          }
        </ul>
        @if (view() === 'ANALYZING') {
          @if (streamFailed()) {
            <button type="button" class="primary" (click)="runStream()">Analyse again</button>
          } @else {
            <p aria-live="polite">Analysing… {{ detections().length }} found so far</p>
          }
        }
      </section>

      @if (view() === 'GAPS' && currentCard(); as card) {
        <section class="mt-4 grid max-w-lg gap-3 rounded border p-3" data-testid="gap" aria-live="polite">
          <p class="text-sm">{{ answered() + 1 }} of {{ answered() + cards().length }}</p>
          <h2 class="font-semibold">{{ card.prompt }}</h2>
          @if (card.kind === 'CONFIRM') {
            <div class="flex gap-2">
              <button type="button" class="primary" (click)="answer(card, card.value ?? '')">Correct</button>
              <button type="button" class="secondary" (click)="typing.set(true)">Change</button>
            </div>
          }
          @if (card.kind === 'PHOTO' && !typing() && photos().length < maxPhotos) {
            <label class="secondary w-fit"
              >{{ busy() ? 'Uploading…' : 'Take photo' }}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                class="sr-only"
                [disabled]="busy()"
                (change)="addPhotos($any($event.target), true)"
            /></label>
            <button type="button" class="w-fit underline" (click)="typing.set(true)">Type instead</button>
          } @else if (card.kind !== 'CONFIRM' || typing()) {
            @if (card.fact === conditionGap) {
              <div class="flex flex-wrap gap-2">
                @for (c of conditions; track c[0]) {
                  <button type="button" class="secondary" (click)="answer(card, c[0])">{{ c[1] }}</button>
                }
              </div>
            } @else {
              <div class="flex flex-wrap gap-2">
                @for (option of card.options; track option) {
                  <button type="button" class="secondary" (click)="answer(card, option)">{{ option }}</button>
                }
              </div>
              <label
                >{{ card.fact }}
                <input
                  maxlength="500"
                  [value]="draftAnswer()"
                  (input)="draftAnswer.set($any($event.target).value)"
              /></label>
              <button
                type="button"
                class="primary w-fit"
                [disabled]="!draftAnswer().trim()"
                (click)="answer(card, draftAnswer())"
              >
                Save
              </button>
            }
          }
          <div class="flex gap-4">
            <button type="button" class="underline" (click)="skip(card)">Skip</button>
            <button type="button" class="underline" (click)="step.set('REVIEW')">To overview</button>
          </div>
        </section>
      }

      @if (view() === 'REVIEW') {
        <form class="mt-4 grid max-w-lg gap-4" (submit)="publish($event)">
          <p>Listing {{ percentComplete() }} % complete</p>
          @if (cards().length || skipped().size) {
            <section class="rounded border border-amber-300 bg-amber-50 p-3" aria-label="Open points">
              <p>Still open: {{ openNames() }}</p>
              <button type="button" class="secondary mt-2" (click)="answerOpenPoints()">
                Answer open points
              </button>
            </section>
          }

          @if (draft()?.privacyWarnings?.length) {
            <section class="rounded border border-rose-300 bg-rose-50 p-3" aria-label="Privacy check">
              <h2 class="font-semibold">Check before publishing</h2>
              @for (warning of draft()?.privacyWarnings; track $index) {
                <div class="mt-2">
                  <p>Photo {{ warning.photo }}: {{ warning.text }}</p>
                  <label class="flex! items-center gap-1 font-normal!"
                    ><input
                      type="checkbox"
                      [checked]="excluded().has(warning.photo! - 1)"
                      (change)="toggleExcluded(warning.photo! - 1)"
                    />
                    Leave out photo {{ warning.photo }}</label
                  >
                </div>
              }
            </section>
          }

          <label
            >Title
            <input
              name="title"
              required
              maxlength="120"
              [value]="fields().title"
              (input)="setField('title', $any($event.target).value)"
          /></label>
          <label
            >Category
            <select name="category" required (change)="setField('category', $any($event.target).value)">
              @for (category of categories(); track category.name) {
                <option [value]="category.name" [selected]="category.name === fields().category">
                  {{ category.name }}
                </option>
              }
            </select>
          </label>
          <label
            >Condition
            <select name="condition" required (change)="setField('condition', $any($event.target).value)">
              <option value="" disabled [selected]="!fields().condition">Choose condition</option>
              @for (condition of conditions; track condition[0]) {
                <option [value]="condition[0]" [selected]="condition[0] === fields().condition">
                  {{ condition[1] }}
                </option>
              }
            </select>
            @if (!draft()?.condition && !fields().condition) {
              <span class="text-sm font-normal"> The photos don't show the condition — please choose it. </span>
            } @else if (draft()?.condition && draft()?.condition === fields().condition) {
              <span class="text-sm font-normal">Suggested from the photos — please check.</span>
            }
          </label>
          <label
            >Description
            <textarea
              name="description"
              required
              maxlength="4000"
              rows="5"
              [value]="fields().description"
              (input)="setField('description', $any($event.target).value)"
            ></textarea>
          </label>

          <fieldset class="grid gap-2">
            <legend class="font-semibold">Details</legend>
            <p class="text-sm">Only details you confirm or that come from a label are published.</p>
            @for (fact of facts(); track fact.name; let i = $index) {
              <div class="grid grid-cols-[7rem_1fr] items-center gap-2" data-testid="fact">
                <label [for]="'fact-' + i" class="font-normal!">{{ fact.name }}</label>
                <input
                  [id]="'fact-' + i"
                  maxlength="500"
                  [value]="fact.value"
                  (input)="editFact(i, $any($event.target).value)"
                />
                <span
                  class="col-start-2 w-fit rounded px-2 text-sm {{ markerStyles[fact.source] }}"
                  data-testid="marker"
                  >{{ markers[fact.source] }}</span
                >
                <div class="col-start-2 flex gap-3 text-sm">
                  @if (fact.source === 'WEB' && fact.sourceUrl) {
                    <a [href]="fact.sourceUrl" target="_blank" rel="noopener noreferrer" class="underline"
                      >Source</a
                    >
                  }
                  @if (fact.source === 'SUGGESTION' || fact.source === 'WEB') {
                    <label class="flex! items-center gap-1 font-normal!"
                      ><input
                        type="checkbox"
                        [attr.aria-label]="fact.name + ' is correct'"
                        (change)="confirmFact(i)"
                      />
                      This is correct</label
                    >
                  }
                  <button
                    type="button"
                    class="underline"
                    [attr.aria-label]="'Remove ' + fact.name"
                    (click)="removeFact(i)"
                  >
                    Remove
                  </button>
                </div>
              </div>
            } @empty {
              <p class="text-sm">No details found in the photos.</p>
            }
            <button
              type="button"
              class="secondary w-fit"
              [disabled]="!canLookUp() || lookingUp()"
              (click)="completeFacts()"
            >
              {{ lookingUp() ? 'Searching the web…' : 'Complete technical data' }}
            </button>
            @if (!canLookUp()) {
              <p class="text-sm">Confirm the model first — we only look up what we know.</p>
            }
            @if (webNote()) {
              <p class="text-sm">{{ webNote() }}</p>
            }
          </fieldset>

          <fieldset class="grid gap-2">
            <legend class="font-semibold">Price</legend>
            <app-price-panel [estimate]="draft()?.price" [condition]="fields().condition" [(price)]="price" />
            <label
              >Your price (CHF)
              <input
                name="price"
                type="number"
                required
                min="0.01"
                max="9999999999.99"
                step="0.01"
                [value]="price() ?? ''"
                (input)="price.set($any($event.target).valueAsNumber || null)"
            /></label>
          </fieldset>

          <label
            >Postcode
            <input
              name="postcode"
              required
              pattern="[0-9]{4}"
              inputmode="numeric"
              [value]="postcode()"
              (input)="postcode.set($any($event.target).value)"
          /></label>
          <label
            >Locality
            <input
              name="locality"
              required
              maxlength="120"
              [value]="locality()"
              (input)="locality.set($any($event.target).value)"
          /></label>

          <button type="submit" class="primary" [disabled]="busy()">
            {{ busy() ? 'Please wait…' : 'Publish listing' }}
          </button>
        </form>
      }
    }
  `,
})
export class Sell {
  private readonly api = inject(SellingService);
  private readonly stream = inject(DraftStream);
  private readonly banner = inject(ErrorBanner);
  private readonly router = inject(Router);
  protected readonly maxPhotos = MAX_PHOTOS;
  protected readonly markers = MARKERS;
  protected readonly markerStyles = MARKER_STYLES;
  protected readonly conditionGap = CONDITION;
  protected readonly conditions: [Condition, string][] = [
    ['NEW', 'New'],
    ['LIKE_NEW', 'Like new'],
    ['GOOD', 'Good'],
    ['USED', 'Used'],
    ['DEFECTIVE', 'Defective'],
  ];
  protected readonly categories = toSignal(inject(ListingsService).categories(), {
    initialValue: [],
  });
  protected readonly step = signal<Step>('PHOTOS');
  protected readonly photos = signal<SellPhoto[]>([]);
  protected readonly shownPhoto = signal(0);
  protected readonly busy = signal(false);
  protected readonly streamFailed = signal(false);
  protected readonly detections = signal<Detection[]>([]);
  protected readonly privacyMarks = signal<PrivacyMark[]>([]);
  protected readonly aiGaps = signal<Gap[]>([]);
  protected readonly skipped = signal(new Set<string>());
  protected readonly answered = signal(0);
  protected readonly typing = signal(false);
  protected readonly draftAnswer = signal('');
  protected readonly draft = signal<ListingDraft | null>(null);
  protected readonly fields = signal<Record<Field, string>>({
    title: '',
    category: 'Computers',
    condition: '',
    description: '',
  });
  protected readonly facts = signal<Fact[]>([]);
  protected readonly lookingUp = signal(false);
  protected readonly webNote = signal('');
  // 0-based indexes of photos the seller leaves out of the listing
  protected readonly excluded = signal(new Set<number>());
  protected readonly keyFacts = computed(
    () => this.categories().find((c) => c.name === this.fields().category)?.keyFacts ?? [],
  );
  protected readonly cards = computed(() =>
    openGaps(this.keyFacts(), this.facts(), this.fields().condition, this.aiGaps(), this.skipped()),
  );
  protected readonly currentCard = computed<GapCard | undefined>(() => this.cards()[0]);
  // GAPS with nothing left to ask is the review
  protected readonly view = computed<Step>(() =>
    this.step() === 'GAPS' && !this.currentCard() ? 'REVIEW' : this.step(),
  );
  protected readonly percentComplete = computed(() =>
    Math.round(completeness(this.keyFacts(), this.facts()) * 100),
  );
  protected readonly openNames = computed(() =>
    [...new Set([...this.cards().map((c) => c.fact), ...this.skipped()])].join(', '),
  );
  protected readonly photoIdsToPublish = computed(() =>
    (this.draft()?.photoIds ?? []).filter((_, i) => !this.excluded().has(i)),
  );
  protected readonly canLookUp = computed(() =>
    this.facts().some(
      (f) =>
        f.name === 'Model' && f.value.trim() && (f.source === 'LABEL' || f.source === 'SELLER'),
    ),
  );
  protected readonly price = signal<number | null>(null);
  protected readonly postcode = signal('');
  protected readonly locality = signal('');
  // fields the seller typed in keep their value when the draft is re-run
  private readonly sellerFields = new Set<Field>();

  protected marksOn(photo: number): { box: number[]; label: string; privacy: boolean }[] {
    return [
      ...this.detections()
        .filter((d) => d.photo === photo)
        .map((d) => ({ box: d.box ?? [], label: d.label ?? '', privacy: false })),
      ...this.privacyMarks()
        .filter((p) => p.photo === photo)
        .map((p) => ({ box: p.box ?? [], label: p.text ?? '', privacy: true })),
    ];
  }

  protected addPhotos(input: HTMLInputElement, upload = false): void {
    const files = Array.from(input.files ?? []).slice(0, MAX_PHOTOS - this.photos().length);
    input.value = '';
    if (!files.length) return;
    this.photos.update((photos) => [
      ...photos,
      ...files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    ]);
    if (upload) this.analyse();
  }

  protected removePhoto(index: number): void {
    URL.revokeObjectURL(this.photos()[index].url);
    this.photos.update((photos) => photos.filter((_, i) => i !== index));
  }

  /** Uploads the photos that have no id yet, then streams the draft. */
  protected analyse(): void {
    const fresh = this.photos().filter((p) => p.id === undefined);
    if (!this.photos().length || this.busy()) return;
    if (!fresh.length) {
      void this.runStream();
      return;
    }
    this.busy.set(true);
    this.api.uploadPhotos({ body: { photos: fresh.map((p) => p.file) } }).subscribe({
      next: (ids) => {
        this.photos.update((photos) => {
          let next = 0;
          return photos.map((p) => (p.id === undefined ? { ...p, id: ids[next++] } : p));
        });
        this.busy.set(false);
        void this.runStream();
      },
      error: () => this.busy.set(false),
    });
  }

  protected async runStream(): Promise<void> {
    const hadDraft = !!this.draft();
    const photoGap = this.currentCard();
    this.step.set('ANALYZING');
    this.streamFailed.set(false);
    this.detections.set([]);
    this.privacyMarks.set([]);
    this.aiGaps.set([]);
    let drafted = false;
    try {
      await this.stream.run(
        {
          photoIds: this.photos().map((p) => p.id!),
          confirmedFacts: this.facts()
            .filter((f) => f.source === 'SELLER' && f.value.trim())
            .map((f) => ({ name: f.name, value: f.value.trim() })),
        },
        (event) => {
          if (this.onEvent(event)) drafted = true;
        },
      );
    } catch (error) {
      this.banner.show(error instanceof Error ? error.message : 'The server is not reachable.');
    }
    if (drafted) {
      this.step.set('GAPS');
    } else if (hadDraft) {
      // a failed re-run keeps the previous draft; the photo card counts as skipped
      if (photoGap) this.skip(photoGap);
      this.step.set('GAPS');
    } else {
      this.streamFailed.set(true);
    }
  }

  /** Applies one stream event; true when it was the draft. */
  private onEvent(event: DraftEvent): boolean {
    switch (event.type) {
      case 'DETECTION':
        this.detections.update((all) => [...all, event.detection!]);
        this.shownPhoto.set((event.detection!.photo ?? 1) - 1);
        return false;
      case 'PRIVACY':
        this.privacyMarks.update((all) => [...all, event.privacy!]);
        return false;
      case 'GAP':
        this.aiGaps.update((all) => [...all, event.gap!]);
        return false;
      case 'DRAFT':
        this.applyDraft(event.draft!);
        return true;
      case 'ERROR':
        this.banner.show(event.detail ?? 'The draft could not be created.');
        return false;
    }
  }

  private applyDraft(draft: ListingDraft): void {
    this.draft.set(draft);
    this.fields.update((fields) => {
      const next = { ...fields };
      for (const key of ['title', 'category', 'condition', 'description'] as const) {
        // a draft without condition clears an earlier suggestion: the seller has to choose
        const value = draft[key] ?? '';
        if ((value || key === 'condition') && !this.sellerFields.has(key)) next[key] = value;
      }
      return next;
    });
    const confirmed = this.facts().filter((f) => f.source === 'SELLER');
    const fresh = (draft.facts ?? [])
      .filter((f) => f.name && !confirmed.some((c) => c.name === f.name))
      .map((f) => ({
        name: f.name!,
        value: f.value ?? '',
        source: f.source ?? 'SUGGESTION',
        sourceUrl: f.sourceUrl,
      }));
    this.facts.set([...confirmed, ...fresh]);
  }

  protected answer(card: GapCard, value: string): void {
    if (card.fact === CONDITION) {
      this.setField('condition', value);
    } else {
      const fact: Fact = { name: card.fact, value: value.trim(), source: 'SELLER' };
      this.facts.update((facts) =>
        facts.some((f) => f.name === card.fact)
          ? facts.map((f) => (f.name === card.fact ? fact : f))
          : [fact, ...facts],
      );
    }
    this.nextCard();
  }

  protected skip(card: GapCard): void {
    this.skipped.update((set) => new Set(set).add(card.fact));
    this.nextCard();
  }

  private nextCard(): void {
    this.answered.update((n) => n + 1);
    this.typing.set(false);
    this.draftAnswer.set('');
  }

  protected answerOpenPoints(): void {
    this.skipped.set(new Set());
    this.answered.set(0);
    this.step.set('GAPS');
  }

  protected setField(field: Field, value: string): void {
    this.sellerFields.add(field);
    this.fields.update((fields) => ({ ...fields, [field]: value }));
  }

  protected editFact(index: number, value: string): void {
    this.facts.update((facts) =>
      facts.map((f, i) => (i === index ? { ...f, value, source: 'SELLER' } : f)),
    );
  }

  protected confirmFact(index: number): void {
    this.editFact(index, this.facts()[index].value);
  }

  protected toggleExcluded(index: number): void {
    this.excluded.update((set) => {
      const next = new Set(set);
      if (!next.delete(index)) next.add(index);
      return next;
    });
  }

  protected completeFacts(): void {
    if (!this.canLookUp() || this.lookingUp()) return;
    this.lookingUp.set(true);
    this.webNote.set('');
    const facts = this.facts()
      .filter((f) => f.value.trim())
      .map((f) => ({ name: f.name, value: f.value.trim(), source: f.source }));
    const { title, category } = this.fields();
    this.api.completeFacts({ body: { title: title.trim(), category, facts } }).subscribe({
      next: (found) => {
        const fresh = found
          .filter((f) => f.name && !this.facts().some((known) => known.name === f.name))
          .map((f) => ({
            name: f.name!,
            value: f.value ?? '',
            source: 'WEB' as const,
            sourceUrl: f.sourceUrl,
          }));
        this.facts.update((all) => [...all, ...fresh]);
        if (!fresh.length) this.webNote.set('Nothing reliable found on the web for this model.');
        this.lookingUp.set(false);
      },
      error: () => this.lookingUp.set(false),
    });
  }

  protected removeFact(index: number): void {
    this.facts.update((facts) => facts.filter((_, i) => i !== index));
  }

  protected publish(event: Event): void {
    event.preventDefault();
    const draft = this.draft();
    const price = this.price();
    const fields = this.fields();
    if (!draft || price === null || !fields.condition || this.busy()) return;
    const body: CreateListingRequest = {
      title: fields.title.trim(),
      description: fields.description.trim(),
      category: fields.category,
      condition: fields.condition as Condition,
      priceChf: price,
      postcode: this.postcode(),
      locality: this.locality().trim(),
      attributes: Object.fromEntries(
        this.facts()
          .filter((f) => f.source !== 'SUGGESTION' && f.source !== 'WEB' && f.value.trim())
          .map((f) => [f.name, f.value.trim()]),
      ),
      photoIds: this.photoIdsToPublish(),
    };
    this.busy.set(true);
    this.api.publish({ body }).subscribe({
      next: (listing) => void this.router.navigate(['/listings', listing.id]),
      error: () => this.busy.set(false),
    });
  }
}
```

Notes for the implementer:
- `answered` resets with `answerOpenPoints`; "x of y" is `answered + 1` of `answered + open cards`, so it stays correct while cards disappear.
- Generated model fields are optional unless springdoc marks them required, hence the `?? ''` / `?? []` above.
- Check the generated names `Detection`, `PrivacyMark`, `Gap`, `CategoryInfo` in `frontend/src/app/api/models.ts`; springdoc may prefix nested records (e.g. `DraftEventDetection`). Use whatever was generated.

- [ ] **Step 4: Run all frontend checks, expect PASS**

```bash
cd frontend && pnpm run format && pnpm run format:check && pnpm exec ng lint && pnpm exec ng test --watch=false && pnpm exec ng build
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/pages/sell.ts frontend/src/app/pages/sell.spec.ts
git commit -m "Sell: live detections and a guided, skippable gap flow"
```

---

### Task 10: End-to-end check

- [ ] **Step 1: Full checks**

```bash
cd backend && ./mvnw verify
```

```bash
cd frontend && pnpm run api && pnpm run format:check && pnpm exec ng lint && pnpm exec ng test --watch=false && pnpm exec ng build
```

`git status` must show no change to `frontend/openapi.json` or `frontend/src/app/api/` (else commit them).

- [ ] **Step 2: Run locally with a real key** (`ANTHROPIC_API_KEY` set): `cd backend && ./mvnw spring-boot:run` and `cd frontend && pnpm start`, sell a bike with 2 photos. Check: markings appear one by one (not all at the end), boxes sit roughly on the right spot, gap cards appear in the order Brand/Model → Condition → rest, a photo card re-runs the stream with only one new upload (Network tab), skip and "To overview" work, publish works.

- [ ] **Step 3: Staging buffering check** after deploying the branch: in the browser's Network tab the `stream` request's events must arrive spread over time. If they arrive all at once, the proxy in front of the backend buffers: disable response buffering for `/api/listing-drafts/stream` there.
