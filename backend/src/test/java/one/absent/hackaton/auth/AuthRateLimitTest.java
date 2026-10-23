package one.absent.hackaton.auth;

import static org.assertj.core.api.Assertions.assertThat;
import java.time.Clock;
import org.junit.jupiter.api.Test;

class AuthRateLimitTest {
    @Test
    void limitsAttemptsPerAddress() {
        var limiter = new AuthRateLimitFilter(Clock.systemUTC());
        for (int i = 0; i < 20; i++) assertThat(limiter.allow("client-a")).isTrue();
        assertThat(limiter.allow("client-a")).isFalse();
        assertThat(limiter.allow("client-b")).isTrue();
    }
}
