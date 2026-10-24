package one.absent.hackaton.question;

import java.time.Instant;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Getter
@Setter
@NoArgsConstructor
public class ListingQuestion {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false)
    private Long listingId;
    @Column(nullable = false)
    private String askerId;
    @Column(nullable = false, length = 120)
    private String askerName;
    @Column(name = "question_text", nullable = false, length = 1000)
    private String text;
    @Column(nullable = false)
    private Instant createdAt;
    @Column(length = 1000)
    private String answer;
    private Instant answeredAt;
}
