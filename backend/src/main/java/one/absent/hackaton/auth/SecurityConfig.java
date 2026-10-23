package one.absent.hackaton.auth;

import java.util.Locale;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.crypto.password.Pbkdf2PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.session.web.http.CookieSerializer;
import org.springframework.session.web.http.DefaultCookieSerializer;

@Configuration
public class SecurityConfig {
    @Bean
    PasswordEncoder passwordEncoder() {
        return Pbkdf2PasswordEncoder.defaultsForSpringSecurity_v5_8();
    }

    @Bean
    UserDetailsService userDetailsService(AccountRepository accounts) {
        return email -> accounts.byEmail(email.strip().toLowerCase(Locale.ROOT))
            .map(a -> User.withUsername(a.email()).password(a.passwordHash()).roles("USER").build())
            .orElseThrow(() -> new UsernameNotFoundException("Invalid credentials"));
    }

    @Bean
    CookieSerializer cookieSerializer() {
        var cookie = new DefaultCookieSerializer();
        cookie.setCookiePath("/");
        cookie.setUseHttpOnlyCookie(true);
        cookie.setSameSite("Lax");
        // Secure is inferred from HTTPS, including the existing trusted proxy setup.
        return cookie;
    }

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.GET, "/api/info", "/actuator/health", "/actuator/health/**",
                    "/api/auth/csrf", "/api/listings", "/api/listings/*", "/api/photos/*",
                    "/api/docs", "/api/docs/**", "/swagger-ui/**", "/api/openapi.json", "/api/openapi.json/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/auth/register", "/api/auth/login",
                    "/api/auth/forgot-password", "/api/auth/reset-password").permitAll()
                .requestMatchers("/error").permitAll()
                .anyRequest().authenticated())
            .requestCache(cache -> cache.disable())
            .exceptionHandling(errors -> errors
                .authenticationEntryPoint((req, res, ex) -> problem(res, 401, "Please sign in."))
                .accessDeniedHandler((req, res, ex) -> problem(res, 403, "Access denied or invalid CSRF token.")))
            .formLogin(form -> form.loginProcessingUrl("/api/auth/login").usernameParameter("email")
                .successHandler((req, res, auth) -> res.setStatus(204))
                .failureHandler((req, res, ex) -> problem(res, 401, "Invalid email or password.")))
            .logout(logout -> logout.logoutUrl("/api/auth/logout").deleteCookies("SESSION")
                .logoutSuccessHandler((req, res, auth) -> res.setStatus(204)))
            .addFilterBefore(new AuthRateLimitFilter(), UsernamePasswordAuthenticationFilter.class)
            .build(); // CSRF stays enabled, including login, registration and recovery.
    }

    static void problem(jakarta.servlet.http.HttpServletResponse response, int status, String detail)
            throws java.io.IOException {
        response.setStatus(status);
        response.setContentType("application/problem+json");
        response.getWriter().write("{\"status\":" + status + ",\"detail\":\"" + detail + "\"}");
    }
}
