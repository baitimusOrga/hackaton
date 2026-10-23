package one.absent.hackaton.selling;

import java.time.Instant;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Getter
@Setter
@NoArgsConstructor
public class Photo {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, length = 100)
    private String contentType;
    private byte[] data;
    @Column(length = 200)
    private String storageKey;
    @Column(nullable = false)
    private String sellerId;
    @Column(nullable = false)
    private Instant createdAt;
    private Long listingId;
}
