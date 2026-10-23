package one.absent.hackaton.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Explicit local-only fixture; never include demo credentials in a Flyway migration. */
@Component
@Profile("local & !staging & !prod & !production & !test")
public class LocalTestUserSeeder implements ApplicationRunner {
    public static final String EMAIL = "test@example.com";
    public static final String PASSWORD = "LocalTest123!";

    private final AccountRepository accounts;
    private final PasswordEncoder encoder;
    private final String environment;
    private final String databaseUrl;

    public LocalTestUserSeeder(AccountRepository accounts, PasswordEncoder encoder,
            @Value("${app.env}") String environment, @Value("${spring.datasource.url}") String databaseUrl) {
        this.accounts = accounts;
        this.encoder = encoder;
        this.environment = environment;
        this.databaseUrl = databaseUrl;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments arguments) {
        if (!environment.equals("dev") || !databaseUrl.matches(
                "jdbc:postgresql://(localhost|127\\.0\\.0\\.1|\\[::1\\])(:[0-9]+)?/[a-zA-Z0-9_-]+")) {
            throw new IllegalStateException("The local test user requires app.env=dev and a loopback Postgres database URL.");
        }
        if (accounts.findByEmail(EMAIL).isPresent()) return;
        var account = new Account(EMAIL, encoder.encode(PASSWORD), "Local Test User");
        account.setLocation("Luzern");
        account.setCanton("LU");
        accounts.save(account);
    }
}
