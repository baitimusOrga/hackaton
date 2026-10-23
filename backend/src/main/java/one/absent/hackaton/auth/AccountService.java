package one.absent.hackaton.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.mail.MailException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.session.jdbc.JdbcIndexedSessionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AccountService {
    private final AccountRepository accounts;
    private final PasswordEncoder encoder;
    private final RecoveryMail mail;
    private final JdbcIndexedSessionRepository sessions;
    private final SecureRandom random = new SecureRandom();

    public AccountService(AccountRepository accounts, PasswordEncoder encoder, RecoveryMail mail,
                          JdbcIndexedSessionRepository sessions) {
        this.accounts = accounts;
        this.encoder = encoder;
        this.mail = mail;
        this.sessions = sessions;
    }

    @Transactional
    public void register(AuthController.Register request) {
        try {
            accounts.create(normalize(request.email()), encoder.encode(request.password()),
                request.displayName().strip(), Instant.now());
        } catch (DuplicateKeyException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Unable to register with these details.");
        }
    }

    public void forgotPassword(String email) {
        accounts.byEmail(normalize(email)).ifPresent(account -> {
            byte[] bytes = new byte[32];
            random.nextBytes(bytes);
            String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
            accounts.setResetToken(account.id(), hash(token), Instant.now().plus(30, ChronoUnit.MINUTES));
            try {
                mail.send(account.email(), token);
            } catch (MailException e) {
                // Never log the address, message, token or SMTP exception (may contain credentials).
                LoggerFactory.getLogger(AccountService.class).warn("Password recovery email could not be delivered; check SMTP configuration.");
            }
        });
    }

    @Transactional
    public void resetPassword(String token, String password) {
        var account = accounts.lockResetToken(hash(token), Instant.now())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "This reset link is invalid or has expired."));
        accounts.resetPassword(account.id(), encoder.encode(password));
        // All browsers must sign in again after recovery.
        sessions.findByPrincipalName(account.email()).keySet().forEach(sessions::deleteById);
    }

    static String normalize(String email) { return email.strip().toLowerCase(Locale.ROOT); }

    static String hash(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
