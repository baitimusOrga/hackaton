package one.absent.hackaton.auction;

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.math.BigDecimal;
import java.time.Instant;

import one.absent.hackaton.listing.Condition;
import one.absent.hackaton.listing.Listing;
import one.absent.hackaton.listing.ListingRepository;
import one.absent.hackaton.listing.SaleMode;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class PurchaseControllerTest {
    @Autowired WebApplicationContext context;
    @Autowired ListingRepository listings;
    MockMvc mvc;

    @BeforeEach void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    long listing(SaleMode mode) {
        var l = new Listing();
        l.setTitle("Chair");
        l.setDescription("Office chair");
        l.setCategory("Office furniture");
        l.setCondition(Condition.GOOD);
        l.setPriceChf(new BigDecimal("100"));
        l.setPostcode("8004");
        l.setLocality("Zürich");
        l.setCreatedAt(Instant.now());
        l.setSellerId("seller");
        l.setSaleMode(mode);
        return listings.saveAndFlush(l).getId();
    }

    @Test void buyingSellsTheListingOnceAndShowsItAsBought() throws Exception {
        long id = listing(SaleMode.FIXED);
        mvc.perform(post("/api/listings/" + id + "/purchase")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/listings/" + id + "/purchase").with(AuctionControllerTest.user("seller")))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/listings/" + id)).andExpect(jsonPath("$.status").value("AVAILABLE"));
        mvc.perform(post("/api/listings/" + id + "/purchase").with(AuctionControllerTest.user("a")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("SOLD"));
        mvc.perform(post("/api/listings/" + id + "/purchase").with(AuctionControllerTest.user("b")))
                .andExpect(status().isConflict());
        mvc.perform(get("/api/me/trades").with(AuctionControllerTest.user("a")))
                .andExpect(jsonPath("$.bought[0].id").value(id));
    }

    @Test void auctionsCannotBeBought() throws Exception {
        long id = listing(SaleMode.AUCTION);
        mvc.perform(post("/api/listings/" + id + "/purchase").with(AuctionControllerTest.user("a")))
                .andExpect(status().isConflict());
    }
}
