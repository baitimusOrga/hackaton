package one.absent.hackaton.config;

import java.io.IOException;
import java.util.List;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {
    @Bean
    JwtDecoder jwtDecoder(@Value("${spring.security.oauth2.resourceserver.jwt.jwk-set-uri}") String jwks,
                          @Value("${app.auth.issuer}") String issuer) {
        var decoder = NimbusJwtDecoder.withJwkSetUri(jwks).jwsAlgorithm(SignatureAlgorithm.RS256).build();
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
            JwtValidators.createDefaultWithIssuer(issuer),
            new JwtClaimValidator<List<String>>("aud", audience -> audience != null && audience.contains("hackaton-api")),
            new JwtClaimValidator<String>("sub", subject -> subject != null && !subject.isBlank())));
        return decoder;
    }

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http
            .csrf(csrf -> csrf.ignoringRequestMatchers("/api/**"))
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .requestCache(cache -> cache.disable())
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.POST, "/api/listings", "/api/listing-drafts").authenticated()
                .requestMatchers(HttpMethod.GET, "/api/photos/**").permitAll()
                .requestMatchers("/api/clearance/**").authenticated()
                .anyRequest().permitAll())
            .exceptionHandling(errors -> errors.authenticationEntryPoint((req, res, ex) -> unauthorized(res)))
            .oauth2ResourceServer(server -> server.jwt(jwt -> {})
                .authenticationEntryPoint((req, res, ex) -> unauthorized(res)))
            .build();
    }

    static void unauthorized(HttpServletResponse response) throws IOException {
        response.setStatus(401);
        response.setHeader("WWW-Authenticate", "Bearer");
        response.setContentType("application/problem+json");
        response.getWriter().write("{\"status\":401,\"detail\":\"Please log in.\"}");
    }
}
