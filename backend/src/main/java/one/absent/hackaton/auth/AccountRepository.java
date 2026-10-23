package one.absent.hackaton.auth;

import java.time.Instant;
import java.util.Optional;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class AccountRepository {
    public record Account(long id, String email, String passwordHash, String displayName,
                          String location, String canton, String contactPreference) {}

    private static final RowMapper<Account> MAPPER = (rs, row) -> new Account(
        rs.getLong("id"), rs.getString("email"), rs.getString("password_hash"),
        rs.getString("display_name"), rs.getString("location"), rs.getString("canton"),
        rs.getString("contact_preference"));

    private final JdbcClient jdbc;

    public AccountRepository(JdbcClient jdbc) { this.jdbc = jdbc; }

    public Optional<Account> byEmail(String email) {
        return jdbc.sql("select * from app_user where email = ?").param(email).query(MAPPER).optional();
    }

    public Account create(String email, String passwordHash, String displayName, Instant now) {
        jdbc.sql("insert into app_user (email, password_hash, display_name, created_at) values (?, ?, ?, ?)")
            .params(email, passwordHash, displayName, java.sql.Timestamp.from(now)).update();
        return byEmail(email).orElseThrow();
    }

    public Account updateProfile(String email, String name, String location, String canton, String preference) {
        jdbc.sql("update app_user set display_name = ?, location = ?, canton = ?, contact_preference = ? where email = ?")
            .param(1, name).param(2, location).param(3, canton, java.sql.Types.VARCHAR)
            .param(4, preference).param(5, email).update();
        return byEmail(email).orElseThrow();
    }

    public void setResetToken(long id, String hash, Instant expires) {
        jdbc.sql("update app_user set reset_token_hash = ?, reset_expires_at = ? where id = ?")
            .params(hash, java.sql.Timestamp.from(expires), id).update();
    }

    public Optional<Account> lockResetToken(String hash, Instant now) {
        return jdbc.sql("select * from app_user where reset_token_hash = ? and reset_expires_at > ? for update")
            .params(hash, java.sql.Timestamp.from(now)).query(MAPPER).optional();
    }

    public void resetPassword(long id, String hash) {
        jdbc.sql("update app_user set password_hash = ?, reset_token_hash = null, reset_expires_at = null where id = ?")
            .params(hash, id).update();
    }
}
