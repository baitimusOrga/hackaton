package one.absent.hackaton.savedsearch;

import java.time.Instant;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Getter
@Setter
@NoArgsConstructor
public class SavedSearch {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false)
    private String ownerId;
    @Column(nullable = false, length = 120)
    private String name;
    @Column(length = 500)
    private String queryText;
    /** JSON of a SearchRequirements record. */
    @Column(nullable = false, length = 20000)
    private String requirements;
    @Column(nullable = false)
    private Instant createdAt;
}
