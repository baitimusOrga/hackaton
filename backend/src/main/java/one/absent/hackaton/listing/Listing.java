package one.absent.hackaton.listing;

import jakarta.persistence.*;
import java.time.Instant;
import one.absent.hackaton.user.User;

@Entity
@Table(name = "listing")
public class Listing {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id")
    private User owner;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private String description;

    @Column(name = "price_cents")
    private Integer priceCents;

    /** File name in the upload directory ({@link ImageStorage}), null = no image. */
    @Column(name = "image_key")
    private String imageKey;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected Listing() {
    }

    public Listing(User owner, String title, String description, Integer priceCents, String imageKey) {
        this.owner = owner;
        this.title = title;
        this.description = description;
        this.priceCents = priceCents;
        this.imageKey = imageKey;
        this.createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public User getOwner() { return owner; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public Integer getPriceCents() { return priceCents; }
    public String getImageKey() { return imageKey; }
    public Instant getCreatedAt() { return createdAt; }
}
