package one.absent.hackaton.ai;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/** Calls the real API (costs a few cents): {@code ./mvnw test -Dtest=AiClientLiveTest -Dai.live=true}. */
@SpringBootTest
@ActiveProfiles("test")
@EnabledIfSystemProperty(named = "ai.live", matches = "true")
class AiClientLiveTest {

    record Capital(String city, String country) {
    }

    @Autowired
    AiClient ai;

    @Test
    void answersInTheRequestedShape() {
        Capital capital = ai.ask("Answer briefly.", "What is the capital of Switzerland?", List.of(), """
                {"type": "object",
                 "properties": {"city": {"type": "string"}, "country": {"type": "string"}},
                 "required": ["city", "country"], "additionalProperties": false}""", Capital.class);

        assertThat(capital.city()).isEqualTo("Bern");
    }
}
