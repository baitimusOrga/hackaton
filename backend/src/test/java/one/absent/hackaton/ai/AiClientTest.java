package one.absent.hackaton.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.json.JsonMapper;

class AiClientTest {

    record Answer(String title) {
    }

    static final String SCHEMA = """
            {"type": "object", "properties": {"title": {"type": "string"}},
             "required": ["title"], "additionalProperties": false}""";

    final RestClient.Builder builder = RestClient.builder();
    final MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();

    AiClient client(String apiKey) {
        return new AiClient(builder, JsonMapper.builder().build(), apiKey, "claude-opus-5-5", "claude-sonnet-5-5", 1000,
                "https://ai.test");
    }

    static String message(String stopReason, String text) {
        return """
                {"stop_reason": "%s", "content": [
                  {"type": "thinking", "thinking": ""},
                  {"type": "text", "text": %s}]}""".formatted(stopReason, JsonMapper.builder().build().writeValueAsString(text));
    }

    @Test
    void sendsImagesAndSchemaAndParsesTheAnswer() {
        server.expect(requestTo("https://ai.test/v1/messages"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("x-api-key", "test-key"))
                .andExpect(header("anthropic-version", "2026-10-21"))
                .andExpect(jsonPath("$.model").value("claude-opus-5-5"))
                .andExpect(jsonPath("$.system").value("Identify the item."))
                .andExpect(jsonPath("$.fallbacks").value("default"))
                .andExpect(jsonPath("$.output_config.format.type").value("json_schema"))
                .andExpect(jsonPath("$.output_config.format.schema.required[0]").value("title"))
                .andExpect(jsonPath("$.messages[0].content[0].type").value("image"))
                .andExpect(jsonPath("$.messages[0].content[0].source.media_type").value("image/png"))
                .andExpect(jsonPath("$.messages[0].content[0].source.data").value("AQID"))
                .andExpect(jsonPath("$.messages[0].content[1].text").value("What is this?"))
                .andRespond(withSuccess(message("end_turn", "{\"title\": \"iMac 27\\\" 5K\"}"), MediaType.APPLICATION_JSON));

        Answer answer = client("test-key").ask("Identify the item.", "What is this?",
                List.of(new AiClient.Image(new byte[] {1, 2, 3}, "image/png")), SCHEMA, Answer.class);

        assertThat(answer.title()).isEqualTo("iMac 27\" 5K");
        server.verify();
    }

    @Test
    void usesTheModelGivenPerCall() {
        server.expect(requestTo("https://ai.test/v1/messages"))
                .andExpect(jsonPath("$.model").value("claude-haiku-5-5"))
                .andExpect(jsonPath("$.fallbacks").doesNotExist())
                .andRespond(withSuccess(message("end_turn", "{\"title\": \"Desk\"}"), MediaType.APPLICATION_JSON));

        Answer answer = client("test-key").ask("claude-haiku-5-5", "s", "t", List.of(), SCHEMA, Answer.class);

        assertThat(answer.title()).isEqualTo("Desk");
        server.verify();
    }

    @Test
    void missingKeyIs503WithoutCallingTheApi() {
        assertThatThrownBy(() -> client("").ask("s", "t", List.of(), SCHEMA, Answer.class))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE));
        server.verify();
    }

    @Test
    void apiErrorIs503() {
        server.expect(requestTo("https://ai.test/v1/messages")).andRespond(withServerError());

        assertThatThrownBy(() -> client("test-key").ask("s", "t", List.of(), SCHEMA, Answer.class))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE));
    }

    @Test
    void webSearchSendsToolWithoutSchemaAndReadsJsonAcrossTextBlocks() {
        String response = JsonMapper.builder().build().writeValueAsString(java.util.Map.of("stop_reason", "end_turn",
                "content", List.of(
                        java.util.Map.of("type", "text", "text", "I'll look it up."),
                        java.util.Map.of("type", "server_tool_use", "name", "web_search"),
                        java.util.Map.of("type", "web_search_tool_result", "content", List.of()),
                        java.util.Map.of("type", "text", "text", "```json\n{\"title\":"),
                        java.util.Map.of("type", "text", "text", "\"Desk\"}\n```"))));
        server.expect(requestTo("https://ai.test/v1/messages"))
                .andExpect(jsonPath("$.tools[0].type").value("web_search_20260209"))
                .andExpect(jsonPath("$.tools[0].max_uses").value(3))
                .andExpect(jsonPath("$.output_config.format").doesNotExist())
                .andExpect(jsonPath("$.output_config.effort").value("low"))
                .andRespond(withSuccess(response, MediaType.APPLICATION_JSON));

        Answer answer = client("test-key").askWithWebSearch("s", "t", Answer.class);

        assertThat(answer.title()).isEqualTo("Desk");
        server.verify();
    }

    @Test
    void refusalOrBrokenJsonIs502() {
        server.expect(requestTo("https://ai.test/v1/messages"))
                .andRespond(withSuccess(message("refusal", ""), MediaType.APPLICATION_JSON));
        server.expect(requestTo("https://ai.test/v1/messages"))
                .andRespond(withSuccess(message("end_turn", "not json"), MediaType.APPLICATION_JSON));
        server.expect(requestTo("https://ai.test/v1/messages"))
                .andRespond(withSuccess(message("pause_turn", "{\"title\": \"Desk\"}"), MediaType.APPLICATION_JSON));
        AiClient client = client("test-key");

        for (int i = 0; i < 3; i++) {
            assertThatThrownBy(() -> client.ask("s", "t", List.of(), SCHEMA, Answer.class))
                    .isInstanceOfSatisfying(ResponseStatusException.class,
                            e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.BAD_GATEWAY));
        }
    }

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
                .andExpect(jsonPath("$.model").value("claude-sonnet-5-5")) // the stream model, not ai.model
                .andExpect(jsonPath("$.tools").doesNotExist())
                .andExpect(jsonPath("$.output_config.effort").value("low"))
                .andExpect(jsonPath("$.output_config.format").doesNotExist())
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
}
