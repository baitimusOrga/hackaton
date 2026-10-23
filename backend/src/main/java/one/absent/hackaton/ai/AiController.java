package one.absent.hackaton.ai;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.core.JsonValue;
import com.anthropic.errors.AnthropicIoException;
import com.anthropic.errors.AnthropicServiceException;
import com.anthropic.errors.RateLimitException;
import com.anthropic.models.messages.Message;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.OutputConfig;
import com.anthropic.models.messages.StopReason;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * Example LLM feature: Claude writes a listing description. The API key stays on the server
 * (ANTHROPIC_API_KEY in the host .env, set as repo secret STAGING_/PROD_ANTHROPIC_API_KEY).
 * Copy this class for new AI features.
 */
@RestController
@RequestMapping("/api/ai")
public class AiController {

    private static final Logger log = LoggerFactory.getLogger(AiController.class);

    public record DescribeRequest(@NotBlank @Size(max = 120) String title, @Size(max = 2000) String notes) {
    }

    public record DescribeResponse(String text, String model) {
    }

    private final AnthropicClient client;   // null when no key is configured
    private final String model;

    public AiController(@Value("${app.llm.api-key}") String apiKey, @Value("${app.llm.model}") String model) {
        this.client = apiKey.isBlank() ? null : AnthropicOkHttpClient.builder().apiKey(apiKey).build();
        this.model = model;
    }

    public boolean configured() {
        return client != null;
    }

    @PostMapping("/describe")
    public DescribeResponse describe(@Valid @RequestBody DescribeRequest req) {
        if (client == null) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "LLM is not configured (ANTHROPIC_API_KEY)");
        }
        String notes = req.notes() == null || req.notes().isBlank() ? "(none)" : req.notes();
        MessageCreateParams params = MessageCreateParams.builder()
                .model(model)
                .maxTokens(16000L)
                .outputConfig(OutputConfig.builder().effort(OutputConfig.Effort.LOW).build())
                .system("You write short, friendly descriptions for listings on a marketplace. "
                        + "Answer with the description only: 2 to 4 sentences, plain text, no headings. "
                        + "Write in the language of the title.")
                .addUserMessage("Title: " + req.title() + "\nSeller's notes: " + notes)
                // if a safety classifier declines, the API retries on a suitable fallback model by itself
                .putAdditionalHeader("anthropic-beta", "server-side-fallback-2026-07-01")
                .putAdditionalBodyProperty("fallbacks", JsonValue.from("default"))
                .build();
        try {
            Message msg = client.messages().create(params);
            if (msg.stopReason().filter(StopReason.REFUSAL::equals).isPresent()) {
                throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "The model declined this request");
            }
            String text = msg.content().stream()
                    .flatMap(b -> b.text().stream())
                    .map(t -> t.text())
                    .collect(Collectors.joining()).trim();
            return new DescribeResponse(text, msg.model().asString());
        } catch (RateLimitException e) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "LLM rate limit, try again shortly");
        } catch (AnthropicServiceException e) {
            log.warn("LLM call failed: {} {}", e.statusCode(), e.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "LLM call failed (" + e.statusCode() + ")");
        } catch (AnthropicIoException e) {
            log.warn("LLM unreachable: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "LLM unreachable");
        }
    }
}
