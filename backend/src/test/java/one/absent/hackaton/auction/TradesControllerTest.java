package one.absent.hackaton.auction;

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.math.BigDecimal;
import java.time.Instant;

import one.absent.hackaton.listing.Condition;
import one.absent.hackaton.listing.Listing;
import one.absent.hackaton.listing.ListingRepository;
import one.absent.hackaton.listing.ListingStatus;
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
class TradesControllerTest {
    @Autowired WebApplicationContext context;
    @Autowired ListingRepository listings;
    @Autowired BidRepository bids;
    MockMvc mvc;

    @BeforeEach void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    @Test void wonAuctionIsBoughtByTheWinnerAndSoldByTheSeller() throws Exception {
        var listing = new Listing();
        listing.setTitle("Chair");
        listing.setDescription("Office chair");
        listing.setCategory("Office furniture");
        listing.setCondition(Condition.GOOD);
        listing.setPriceChf(new BigDecimal("100"));
        listing.setPostcode("8004");
        listing.setLocality("Zürich");
        listing.setCreatedAt(Instant.now());
        listing.setSellerId("seller");
        listing.setSaleMode(SaleMode.AUCTION);
        listing.setEndsAt(Instant.now());
        listing.setStatus(ListingStatus.SOLD);
        long id = listings.saveAndFlush(listing).getId();
        bids.save(new Bid(id, "a", "a", new BigDecimal("300"), Instant.now()));
        bids.save(new Bid(id, "b", "b", new BigDecimal("200"), Instant.now()));

        mvc.perform(get("/api/me/trades").with(AuctionControllerTest.user("a")))
                .andExpect(jsonPath("$.bought[0].id").value(id)).andExpect(jsonPath("$.sold.length()").value(0));
        mvc.perform(get("/api/me/trades").with(AuctionControllerTest.user("b")))
                .andExpect(jsonPath("$.bought.length()").value(0));
        mvc.perform(get("/api/me/trades").with(AuctionControllerTest.user("seller")))
                .andExpect(jsonPath("$.sold[0].id").value(id));
        mvc.perform(get("/api/me/trades")).andExpect(status().isUnauthorized());
    }
}
