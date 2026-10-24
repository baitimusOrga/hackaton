package one.absent.hackaton.listing;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.math.BigDecimal;
import java.time.Instant;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class MyListingsControllerTest {
    @Autowired WebApplicationContext context;
    @Autowired ListingRepository listings;
    MockMvc mvc;

    @BeforeEach void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    static JwtRequestPostProcessor user(String subject) {
        return jwt().jwt(j -> j.subject(subject));
    }

    long listing(String seller, SaleMode mode, ListingStatus status, int bids) {
        var listing = new Listing();
        listing.setTitle("Chair");
        listing.setDescription("Office chair");
        listing.setCategory("Office furniture");
        listing.setCondition(Condition.GOOD);
        listing.setPriceChf(new BigDecimal("100"));
        listing.setPostcode("8004");
        listing.setLocality("Zürich");
        listing.setCreatedAt(Instant.now());
        listing.setSellerId(seller);
        listing.setSaleMode(mode);
        listing.setStatus(status);
        listing.setBidCount(bids);
        return listings.saveAndFlush(listing).getId();
    }

    @Test void listsOnlyMyListingsWithTheirStatus() throws Exception {
        long sold = listing("me", SaleMode.FIXED, ListingStatus.SOLD, 0);
        listing("someone else", SaleMode.FIXED, ListingStatus.AVAILABLE, 0);

        mvc.perform(get("/api/me/listings").with(user("me")))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].listing.id").value(sold))
                .andExpect(jsonPath("$[0].status").value("SOLD"));
        mvc.perform(get("/api/me/listings")).andExpect(status().isUnauthorized());
    }

    @Test void withdrawsAnActiveListingButNotOthersOrAuctionsWithBids() throws Exception {
        long mine = listing("me", SaleMode.FIXED, ListingStatus.AVAILABLE, 0);
        long bidOn = listing("me", SaleMode.AUCTION, ListingStatus.AVAILABLE, 2);
        long theirs = listing("someone else", SaleMode.FIXED, ListingStatus.AVAILABLE, 0);

        mvc.perform(delete("/api/me/listings/" + mine).with(user("me"))).andExpect(status().isNoContent());
        mvc.perform(get("/api/me/listings").with(user("me")))
                .andExpect(jsonPath("$[?(@.listing.id == " + mine + ")].status").value("WITHDRAWN"));
        mvc.perform(delete("/api/me/listings/" + mine).with(user("me"))).andExpect(status().isConflict());
        mvc.perform(delete("/api/me/listings/" + bidOn).with(user("me"))).andExpect(status().isConflict());
        mvc.perform(delete("/api/me/listings/" + theirs).with(user("me"))).andExpect(status().isNotFound());
        mvc.perform(get("/api/listings/" + mine)).andExpect(status().isOk()); // still readable by its link
    }
}
