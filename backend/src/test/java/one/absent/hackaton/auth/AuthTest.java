package one.absent.hackaton.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.Filter;
import jakarta.servlet.http.Cookie;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mail.MailSendException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@ActiveProfiles("test")
class AuthTest {
    @Autowired WebApplicationContext context;
    @Autowired @Qualifier("springSessionRepositoryFilter") Filter sessionFilter;
    @Autowired JdbcClient jdbc;
    @Autowired AccountRepository accounts;
    @Autowired PasswordEncoder encoder;
    @MockitoBean JavaMailSender mail;
    MockMvc mvc;
    private static final AtomicInteger NEXT_CLIENT = new AtomicInteger();
    private String client;

    private record Browser(Cookie cookie, String csrf) {}

    @BeforeEach
    void setup() {
        client = "10.0.0." + NEXT_CLIENT.incrementAndGet();
        jdbc.sql("delete from spring_session_attributes").update();
        jdbc.sql("delete from spring_session").update();
        jdbc.sql("delete from app_user").update();
        mvc = MockMvcBuilders.webAppContextSetup(context)
            .defaultRequest(get("/").with(request -> {
                request.setRemoteAddr(client);
                return request;
            }))
            .addFilter(sessionFilter).apply(springSecurity()).build();
    }

    private Browser csrf(Cookie... cookies) throws Exception {
        var request = get("/api/auth/csrf");
        if (cookies.length > 0) request.cookie(cookies);
        var result = mvc.perform(request).andExpect(status().isOk()).andReturn();
        var cookie = result.getResponse().getCookie("SESSION");
        return new Browser(cookie != null ? cookie : cookies[0], JsonPath.read(result.getResponse().getContentAsString(), "$.token"));
    }

    private MvcResult send(MockHttpServletRequestBuilder request, Browser browser, int expected) throws Exception {
        return mvc.perform(request.servletPath(request.buildRequest(context.getServletContext()).getRequestURI())
            .cookie(browser.cookie()).header("X-CSRF-TOKEN", browser.csrf()))
            .andExpect(status().is(expected)).andReturn();
    }

    private void register(String email) throws Exception {
        send(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content("""
            {"email":"%s","password":"correct horse battery staple","displayName":"Baitimus"}
            """.formatted(email)), csrf(), 201);
    }

    private Browser login(String email) throws Exception {
        Browser before = csrf();
        var result = send(post("/api/auth/login").param("email", email).param("password", "correct horse battery staple"), before, 204);
        Cookie after = result.getResponse().getCookie("SESSION");
        assertThat(after).isNotNull();
        assertThat(after.getValue()).isNotEqualTo(before.cookie().getValue());
        return csrf(after);
    }

    private String recoveryToken(String email) throws Exception {
        send(post("/api/auth/forgot-password").contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\"" + email + "\"}"), csrf(), 202);
        var message = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(mail, atLeastOnce()).send(message.capture());
        String text = message.getValue().getText();
        assertThat(text).contains("http://localhost:4200/reset-password#token=");
        return text.split("#token=")[1].split("\\s")[0];
    }

    @Test
    void registrationHashesPasswordsAndNormalizesEmail() throws Exception {
        register("Baitimus@Example.com");
        var account = accounts.findByEmail("baitimus@example.com").orElseThrow();
        assertThat(account.getPasswordHash()).doesNotContain("correct horse");
        assertThat(encoder.matches("correct horse battery staple", account.getPasswordHash())).isTrue();
        send(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content("""
            {"email":"baitimus@example.com","password":"another long password","displayName":"Other"}
            """), csrf(), 409);
    }

    @Test
    void validatesInputWithoutEchoingSecrets() throws Exception {
        var result = send(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content("""
            {"email":"invalid","password":"secret","displayName":" "}
            """), csrf(), 400);
        assertThat(result.getResponse().getContentAsString()).doesNotContain("secret");
        assertThat(jdbc.sql("select count(*) from app_user").query(Long.class).single()).isZero();
    }

    @Test
    void csrfIsRequiredEvenForPublicMutations() throws Exception {
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isForbidden());
        mvc.perform(post("/api/auth/login").param("email", "any").param("password", "any"))
            .andExpect(status().isForbidden());
        mvc.perform(post("/api/auth/forgot-password").contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isForbidden());
    }

    @Test
    void protectedEndpointsRejectAnonymousUsers() throws Exception {
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
        send(put("/api/auth/me").contentType(MediaType.APPLICATION_JSON).content("{}"), csrf(), 401);
        send(post("/api/listings").contentType(MediaType.APPLICATION_JSON).content("{}"), csrf(), 401);
    }

    @Test
    void loginUsesPersistentPrivateCookieAndLogoutRevokesIt() throws Exception {
        register("baitimus@example.com");
        Browser browser = login("BAITIMUS@example.com");
        assertThat(browser.cookie().isHttpOnly()).isTrue();
        assertThat(browser.cookie().getAttribute("SameSite")).isEqualTo("Lax");
        mvc.perform(get("/api/auth/me").cookie(browser.cookie()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.email").value("baitimus@example.com"))
            .andExpect(jsonPath("$.passwordHash").doesNotExist());
        assertThat(jdbc.sql("select count(*) from spring_session where principal_name = 'baitimus@example.com'")
            .query(Long.class).single()).isEqualTo(1);
        send(post("/api/auth/logout"), browser, 204);
        mvc.perform(get("/api/auth/me").cookie(browser.cookie())).andExpect(status().isUnauthorized());
    }

    @Test
    void httpsCookiesAreSecure() throws Exception {
        var result = mvc.perform(get("/api/auth/csrf").secure(true)).andExpect(status().isOk()).andReturn();
        assertThat(result.getResponse().getCookie("SESSION").getSecure()).isTrue();
    }

    @Test
    void profileUpdatesOnlyTheCurrentAccountAndValidatesCanton() throws Exception {
        register("baitimus@example.com");
        register("other@example.com");
        var browser = login("baitimus@example.com");
        send(put("/api/auth/me").contentType(MediaType.APPLICATION_JSON).content("""
            {"displayName":"New name","location":"Luzern","canton":"LU","contactPreference":"EMAIL","id":999}
            """), browser, 200);
        assertThat(accounts.findByEmail("baitimus@example.com").orElseThrow().getCanton()).isEqualTo("LU");
        assertThat(accounts.findByEmail("other@example.com").orElseThrow().getDisplayName()).isEqualTo("Baitimus");
        send(put("/api/auth/me").contentType(MediaType.APPLICATION_JSON).content("""
            {"displayName":"New name","location":"Luzern","canton":"XX","contactPreference":"EMAIL"}
            """), browser, 400);
    }

    @Test
    void expiredSessionsCannotAccessProfiles() throws Exception {
        register("baitimus@example.com");
        var browser = login("baitimus@example.com");
        jdbc.sql("update spring_session set last_access_time = 0, expiry_time = 0 where principal_name = ?")
            .param("baitimus@example.com").update();
        mvc.perform(get("/api/auth/me").cookie(browser.cookie())).andExpect(status().isUnauthorized());
    }

    @Test
    void incorrectLoginDoesNotRevealWhetherAccountExists() throws Exception {
        register("baitimus@example.com");
        var existing = send(post("/api/auth/login").param("email", "baitimus@example.com").param("password", "wrong"), csrf(), 401);
        var missing = send(post("/api/auth/login").param("email", "missing@example.com").param("password", "wrong"), csrf(), 401);
        assertThat(existing.getResponse().getContentAsString()).isEqualTo(missing.getResponse().getContentAsString());
    }

    @Test
    void recoveryTokenIsHashedSingleUseAndRevokesAllSessions() throws Exception {
        register("baitimus@example.com");
        var browser = login("baitimus@example.com");
        var secondBrowser = login("baitimus@example.com");
        String token = recoveryToken("baitimus@example.com");
        assertThat(jdbc.sql("select reset_token_hash from app_user").query(String.class).single())
            .isEqualTo(AccountService.hash(token)).isNotEqualTo(token);
        String body = "{\"token\":\"" + token + "\",\"password\":\"a new long password\"}";
        send(post("/api/auth/reset-password").contentType(MediaType.APPLICATION_JSON).content(body), csrf(), 204);
        send(post("/api/auth/reset-password").contentType(MediaType.APPLICATION_JSON).content(body), csrf(), 400);
        mvc.perform(get("/api/auth/me").cookie(browser.cookie())).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/auth/me").cookie(secondBrowser.cookie())).andExpect(status().isUnauthorized());
        send(post("/api/auth/login").param("email", "baitimus@example.com").param("password", "correct horse battery staple"), csrf(), 401);
        send(post("/api/auth/login").param("email", "baitimus@example.com").param("password", "a new long password"), csrf(), 204);
    }

    @Test
    void expiredRecoveryTokensAreRejected() throws Exception {
        register("baitimus@example.com");
        String token = recoveryToken("baitimus@example.com");
        jdbc.sql("update app_user set reset_expires_at = ?").param(java.sql.Timestamp.from(Instant.now().minus(1, ChronoUnit.MINUTES))).update();
        send(post("/api/auth/reset-password").contentType(MediaType.APPLICATION_JSON)
            .content("{\"token\":\"" + token + "\",\"password\":\"a new long password\"}"), csrf(), 400);
    }

    @Test
    void requestingAnotherRecoveryLinkInvalidatesThePreviousLink() throws Exception {
        register("baitimus@example.com");
        String first = recoveryToken("baitimus@example.com");
        String second = recoveryToken("baitimus@example.com");
        assertThat(second).isNotEqualTo(first);
        send(post("/api/auth/reset-password").contentType(MediaType.APPLICATION_JSON)
            .content("{\"token\":\"" + first + "\",\"password\":\"a new long password\"}"), csrf(), 400);
    }

    @Test
    void csrfTokenFromBeforeLoginCannotBeReused() throws Exception {
        register("baitimus@example.com");
        var old = csrf();
        var result = send(post("/api/auth/login").param("email", "baitimus@example.com")
            .param("password", "correct horse battery staple"), old, 204);
        mvc.perform(post("/api/auth/logout").cookie(result.getResponse().getCookie("SESSION"))
            .header("X-CSRF-TOKEN", old.csrf())).andExpect(status().isForbidden());
    }

    @Test
    void profileCantonCanBeCleared() throws Exception {
        register("baitimus@example.com");
        var browser = login("baitimus@example.com");
        send(put("/api/auth/me").contentType(MediaType.APPLICATION_JSON).content("""
            {"displayName":"Baitimus","location":"","canton":null,"contactPreference":"IN_APP"}
            """), browser, 200);
        assertThat(accounts.findByEmail("baitimus@example.com").orElseThrow().getCanton()).isNull();
    }

    @Test
    void repeatedRecoveryRequestsAreThrottled() throws Exception {
        var browser = csrf();
        for (int i = 0; i < 20; i++) {
            send(post("/api/auth/forgot-password").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"missing@example.com\"}"), browser, 202);
        }
        var result = send(post("/api/auth/forgot-password").contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\"missing@example.com\"}"), browser, 429);
        assertThat(result.getResponse().getHeader("Retry-After")).isEqualTo("300");
    }

    @Test
    void missingAccountsAndMailFailuresHaveTheSameRecoveryResponse() throws Exception {
        send(post("/api/auth/forgot-password").contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\"missing@example.com\"}"), csrf(), 202);
        verifyNoInteractions(mail);
        register("baitimus@example.com");
        doThrow(new MailSendException("unavailable")).when(mail).send(any(SimpleMailMessage.class));
        send(post("/api/auth/forgot-password").contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\"baitimus@example.com\"}"), csrf(), 202);
    }

    @Test
    void localTestUserIsSeededOnceAndCanSignIn() throws Exception {
        var seeder = new LocalTestUserSeeder(accounts, encoder, "dev", "jdbc:postgresql://localhost:5432/hackaton");
        seeder.run(null);
        var original = accounts.findByEmail(LocalTestUserSeeder.EMAIL).orElseThrow();
        seeder.run(null);
        var repeated = accounts.findByEmail(LocalTestUserSeeder.EMAIL).orElseThrow();
        assertThat(repeated.getId()).isEqualTo(original.getId());
        assertThat(repeated.getPasswordHash()).isEqualTo(original.getPasswordHash());
        assertThat(repeated.getPasswordHash()).isNotEqualTo(LocalTestUserSeeder.PASSWORD);
        assertThat(repeated.getCanton()).isEqualTo("LU");
        send(post("/api/auth/login").param("email", LocalTestUserSeeder.EMAIL)
            .param("password", LocalTestUserSeeder.PASSWORD), csrf(), 204);
        assertThat(jdbc.sql("select count(*) from app_user").query(Long.class).single()).isEqualTo(1);
    }

    @Test
    void localSeedRefusesOtherEnvironmentsAndRemoteDatabases() {
        org.assertj.core.api.Assertions.assertThatThrownBy(() ->
            new LocalTestUserSeeder(accounts, encoder, "staging", "jdbc:postgresql://localhost:5432/hackaton").run(null))
            .isInstanceOf(IllegalStateException.class);
        org.assertj.core.api.Assertions.assertThatThrownBy(() ->
            new LocalTestUserSeeder(accounts, encoder, "dev", "jdbc:postgresql://db.example.com:5432/hackaton").run(null))
            .isInstanceOf(IllegalStateException.class);
        assertThat(jdbc.sql("select count(*) from app_user").query(Long.class).single()).isZero();
    }
}
