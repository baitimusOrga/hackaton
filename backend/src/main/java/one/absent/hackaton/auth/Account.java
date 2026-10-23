package one.absent.hackaton.auth;

import java.time.Instant;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "app_user")
@Getter
@Setter
@NoArgsConstructor
public class Account {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, unique = true, length = 254)
    private String email;
    @Column(nullable = false, length = 255)
    private String passwordHash;
    @Column(nullable = false, length = 80)
    private String displayName;
    @Column(nullable = false, length = 120)
    private String location = "";
    @Column(length = 2)
    private String canton;
    @Column(nullable = false, length = 10)
    private String contactPreference = "IN_APP";
    @Column(nullable = false)
    private Instant createdAt;
    @Column(unique = true, length = 64)
    private String resetTokenHash;
    private Instant resetExpiresAt;

    public Account(String email, String passwordHash, String displayName) {
        this.email = email;
        this.passwordHash = passwordHash;
        this.displayName = displayName;
        this.createdAt = Instant.now();
    }
}
