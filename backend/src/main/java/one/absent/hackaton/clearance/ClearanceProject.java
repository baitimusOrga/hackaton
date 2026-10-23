package one.absent.hackaton.clearance;

import java.time.Instant;
import java.time.LocalDate;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Getter
@Setter
@NoArgsConstructor
public class ClearanceProject {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false)
    private String ownerId;
    @Column(nullable = false, length = 120)
    private String companyName;
    @Column(nullable = false, length = 4)
    private String postcode;
    @Column(nullable = false, length = 120)
    private String locality;
    @Column(nullable = false)
    private LocalDate deadline;
    @Enumerated(EnumType.STRING) @Column(length = 20)
    private Route route;
    @Column(nullable = false)
    private Instant createdAt;
}
