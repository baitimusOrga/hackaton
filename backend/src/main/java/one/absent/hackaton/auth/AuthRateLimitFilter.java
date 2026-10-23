package one.absent.hackaton.auth;

import java.io.IOException;
import java.time.Clock;
import java.util.HashMap;
import java.util.Map;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

/** Bounded per-process throttle. Shared limiting belongs at the edge for multiple replicas. */
final class AuthRateLimitFilter extends OncePerRequestFilter {
    private record Window(long start, int count) {}
    private final Map<String, Window> windows = new HashMap<>();
    private final Clock clock;

    AuthRateLimitFilter() { this(Clock.systemUTC()); }
    AuthRateLimitFilter(Clock clock) { this.clock = clock; }

    synchronized boolean allow(String address) {
        long now = clock.millis();
        windows.entrySet().removeIf(e -> now - e.getValue().start() >= 300_000);
        Window current = windows.getOrDefault(address, new Window(now, 0));
        if (current.count() >= 20 || (!windows.containsKey(address) && windows.size() >= 10_000)) return false;
        windows.put(address, new Window(current.start(), current.count() + 1));
        return true;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String path = request.getServletPath();
        if (request.getMethod().equals("POST") && (path.equals("/api/auth/login")
                || path.equals("/api/auth/register") || path.equals("/api/auth/forgot-password")
                || path.equals("/api/auth/reset-password")) && !allow(request.getRemoteAddr())) {
            response.setHeader("Retry-After", "300");
            SecurityConfig.problem(response, 429, "Too many attempts. Try again in five minutes.");
            return;
        }
        chain.doFilter(request, response);
    }
}
