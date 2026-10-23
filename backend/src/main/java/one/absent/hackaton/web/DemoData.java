package one.absent.hackaton.web;

import java.util.List;
import one.absent.hackaton.listing.Listing;
import one.absent.hackaton.listing.ListingRepository;
import one.absent.hackaton.user.User;
import one.absent.hackaton.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Seed data for an empty database: user demo@example.com and a few listings without images.
 * On with APP_SEED_DEMO=true (default in dev, staging); prod sets it to false.
 */
@Component
@ConditionalOnProperty(name = "app.seed.demo", havingValue = "true")
public class DemoData implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoData.class);

    private final UserRepository users;
    private final ListingRepository listings;
    private final PasswordEncoder passwordEncoder;
    private final String password;

    public DemoData(UserRepository users, ListingRepository listings, PasswordEncoder passwordEncoder,
                    @Value("${app.seed.demo-password}") String password) {
        this.users = users;
        this.listings = listings;
        this.passwordEncoder = passwordEncoder;
        this.password = password;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (users.count() > 0) {
            return;
        }
        User demo = users.save(new User("demo@example.com", passwordEncoder.encode(password), "Demo"));
        listings.saveAll(List.of(
                new Listing(demo, "Road bike, 56 cm", "Aluminium frame, Shimano 105, recently serviced. Pickup in Lucerne.", 45000, null),
                new Listing(demo, "Standing desk", "Electric, 140 x 70 cm, memory positions. Minor scratches on the top.", 22000, null),
                new Listing(demo, "Tutoring: Java and Spring", "Two hours per week, online or on campus.", 3500, null),
                new Listing(demo, "Free: moving boxes", "About 20 boxes, various sizes. Free to a good home.", null, null)));
        log.info("Seeded demo data: demo@example.com and 4 listings");
    }
}
