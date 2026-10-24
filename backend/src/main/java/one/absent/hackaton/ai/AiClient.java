package one.absent.hackaton.ai;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Asks Claude (Anthropic Messages API) for an answer in a fixed JSON shape. */
@Slf4j
@Component
public class AiClient {

    public record Image(byte[] data, String mediaType) {
    }

    private final RestClient http;
    private final JsonMapper json;
    private final String apiKey;
    private final String model;
    private final String streamModel;
    private final int maxTokens;

    @Autowired
    public AiClient(JsonMapper json, @Value("${ai.api-key}") String apiKey, @Value("${ai.model}") String model,
                    @Value("${ai.stream-model}") String streamModel, @Value("${ai.max-tokens}") int maxTokens,
                    @Value("${ai.base-url}") String baseUrl) {
        this(RestClient.builder().requestFactory(timeout()), json, apiKey, model, streamModel, maxTokens, baseUrl);
    }

    AiClient(RestClient.Builder http, JsonMapper json, String apiKey, String model, String streamModel, int maxTokens,
             String baseUrl) {
        this.http = http.baseUrl(baseUrl)
                .defaultHeader("anthropic-version", "2026-10-21")
                .defaultHeader("anthropic-beta", "server-side-fallback-2026-07-01")
                .build();
        this.json = json;
        this.apiKey = apiKey;
        this.model = model;
        this.streamModel = streamModel;
        this.maxTokens = maxTokens;
    }

    /**
     * Sends {@code text} and {@code images} with the {@code system} prompt and returns the answer as {@code type}.
     * {@code schema} is the JSON schema of {@code type}; every object in it needs {@code "additionalProperties": false}.
     */
    public <T> T ask(String system, String text, List<Image> images, String schema, Class<T> type) {
        return ask(model, system, text, images, schema, type);
    }

    /** Like {@link #ask(String, String, List, String, Class)}, but on the given {@code model}. */
    public <T> T ask(String model, String system, String text, List<Image> images, String schema, Class<T> type) {
        return send(request(model, system, text, images, schema, false), type);
    }

    /**
     * Like {@link #ask(String, String, List, String, Class)} without images, but Claude may search the web first.
     * Structured outputs cannot be combined with web search, so the prompt must ask for JSON and the answer is
     * parsed leniently.
     */
    public <T> T askWithWebSearch(String system, String text, Class<T> type) {
        return send(request(model, system, text, List.of(), null, true), type);
    }

    /**
     * Streams the answer and hands each complete, non-blank line to {@code onLine} as soon as it arrives.
     * For prompts that ask for JSON lines; structured output is not used since it is only valid when complete.
     * Runs on {@code ai.stream-model}: a model that writes its first line within seconds.
     */
    public void streamLines(String system, String text, List<Image> images, Consumer<String> onLine) {
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("AI call skipped: ai.api-key (ANTHROPIC_API_KEY) is not set");
            throw unavailable();
        }
        Map<String, Object> request = request(streamModel, system, text, images, null, false);
        request.put("stream", true);
        // without it the model thinks silently first and then writes every line in one burst
        request.put("output_config", Map.of("effort", "low"));
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

    private <T> T send(Map<String, Object> request, Class<T> type) {
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("AI call skipped: ai.api-key (ANTHROPIC_API_KEY) is not set");
            throw unavailable();
        }
        String response;
        try {
            response = http.post().uri("/v1/messages")
                    .header("x-api-key", apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(json.writeValueAsString(request))
                    .retrieve()
                    .body(String.class);
        } catch (RestClientException e) {
            log.warn("AI call failed: {}", e.getMessage());
            throw unavailable();
        }
        try {
            JsonNode message = json.readTree(response);
            String stopReason = message.path("stop_reason").asString();
            if (!"end_turn".equals(stopReason)) {
                log.warn("AI answer unusable, stop_reason={}", stopReason);
                throw unusable();
            }
            // citations split an answer into several text blocks; drop any preamble or ```json fence
            StringBuilder answer = new StringBuilder();
            for (JsonNode block : message.path("content")) {
                if ("text".equals(block.path("type").asString())) {
                    answer.append(block.path("text").asString());
                }
            }
            int start = answer.indexOf("{");
            int end = answer.lastIndexOf("}");
            if (start < 0 || end < start) {
                throw unusable();
            }
            return json.readValue(answer.substring(start, end + 1), type);
        } catch (JacksonException e) {
            log.warn("AI answer is not the expected JSON: {}", e.getOriginalMessage());
            throw unusable();
        }
    }

    private Map<String, Object> request(String model, String system, String text, List<Image> images, String schema,
                                        boolean webSearch) {
        List<Map<String, Object>> content = new ArrayList<>();
        for (Image image : images) {
            content.add(Map.of("type", "image", "source", Map.of("type", "base64", "media_type", image.mediaType(),
                    "data", Base64.getEncoder().encodeToString(image.data()))));
        }
        content.add(Map.of("type", "text", "text", text));

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
        request.put("messages", List.of(Map.of("role", "user", "content", content)));
        // a refused request is retried on a suitable model; Haiku has no server-side fallback
        if (!model.startsWith("claude-haiku")) {
            request.put("fallbacks", "default");
        }
        return request;
    }

    private static JdkClientHttpRequestFactory timeout() {
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory();
        factory.setReadTimeout(Duration.ofSeconds(120));
        // the gzip decompression buffers a streamed answer until it is complete
        factory.enableCompression(false);
        return factory;
    }

    private static ResponseStatusException unavailable() {
        return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "AI is not available right now.");
    }

    private static ResponseStatusException unusable() {
        return new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI gave no usable answer, please try again.");
    }
}
