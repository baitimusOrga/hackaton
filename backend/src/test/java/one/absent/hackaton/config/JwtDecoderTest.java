package one.absent.hackaton.config;

import static org.assertj.core.api.Assertions.*;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import com.sun.net.httpserver.HttpServer;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;

class JwtDecoderTest {
    static RSAKey key;
    static HttpServer server;
    static JwtDecoder decoder;

    @BeforeAll static void setup() throws Exception {
        key = new RSAKeyGenerator(2048).keyID("test-key").generate();
        byte[] jwks = new JWKSet(key.toPublicJWK()).toString().getBytes(StandardCharsets.UTF_8);
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/jwks", exchange -> {
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, jwks.length);
            try (var body = exchange.getResponseBody()) { body.write(jwks); }
        });
        server.start();
        decoder = new SecurityConfig().jwtDecoder("http://127.0.0.1:" + server.getAddress().getPort() + "/jwks", "https://auth.example");
    }
    @AfterAll static void stop() { if (server != null) server.stop(0); }

    String token(String issuer, String audience, Instant expires, RSAKey signingKey) throws Exception {
        var claims = new JWTClaimsSet.Builder().subject("seller-1").issuer(issuer).audience(audience)
            .issueTime(Date.from(Instant.now().minusSeconds(10))).expirationTime(Date.from(expires))
            .claim("name", "Seller").claim("email", "test@example.com").build();
        var jwt = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(key.getKeyID()).build(), claims);
        jwt.sign(new RSASSASigner(signingKey));
        return jwt.serialize();
    }
    @Test void verifiesRs256AndIdentityUsingPublicJwks() throws Exception {
        assertThat(decoder.decode(token("https://auth.example", "hackaton-api", Instant.now().plusSeconds(300), key)).getSubject())
            .isEqualTo("seller-1");
    }
    @Test void rejectsWrongIssuerAudienceExpiredOrForgedTokens() throws Exception {
        for (String invalid : new String[]{
            token("https://wrong.example", "hackaton-api", Instant.now().plusSeconds(300), key),
            token("https://auth.example", "wrong-api", Instant.now().plusSeconds(300), key),
            token("https://auth.example", "hackaton-api", Instant.now().minusSeconds(120), key),
            token("https://auth.example", "hackaton-api", Instant.now().plusSeconds(300), new RSAKeyGenerator(2048).generate())}) {
            assertThatThrownBy(() -> decoder.decode(invalid)).isInstanceOf(JwtException.class);
        }
    }
}
