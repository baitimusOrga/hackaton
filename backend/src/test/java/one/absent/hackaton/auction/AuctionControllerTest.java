package one.absent.hackaton.auction;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.math.BigDecimal;
import java.time.Duration;
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
import org.springframework.http.MediaType;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class AuctionControllerTest {
    @Autowired WebApplicationContext context;
    @Autowired ListingRepository listings;
    @Autowired AuctionService auctions;
    MockMvc mvc;

    @BeforeEach void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    static JwtRequestPostProcessor user(String subject) {
        return jwt().jwt(j -> j.subject(subject).claim("name", subject + "-name"));
    }

    Listing auction(Duration endsIn) {
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
        listing.setEndsAt(Instant.now().plus(endsIn));
        return listings.saveAndFlush(listing);
    }

    ResultActions bid(Listing listing, String bidder, int max) throws Exception {
        return mvc.perform(post("/api/listings/" + listing.getId() + "/auction/bids").with(user(bidder))
                .contentType(MediaType.APPLICATION_JSON).content("{\"maxChf\":" + max + "}"));
    }

    @Test void outbiddingFollowsProxyRules() throws Exception {
        var listing = auction(Duration.ofDays(1));
        bid(listing, "a", 300).andExpect(status().isOk())
                .andExpect(jsonPath("$.currentBidChf").value(100)).andExpect(jsonPath("$.leading").value(true));
        bid(listing, "b", 200).andExpect(status().isOk())
                .andExpect(jsonPath("$.currentBidChf").value(205)).andExpect(jsonPath("$.leading").value(false))
                .andExpect(jsonPath("$.myMaxChf").value(200))
                .andExpect(jsonPath("$.bids[0].automatic").value(true)).andExpect(jsonPath("$.bids[0].mine").value(false))
                .andExpect(jsonPath("$.bids[1].mine").value(true))
                // your own maximum shows on your own rows only
                .andExpect(jsonPath("$.bids[1].myMaxChf").value(200))
                .andExpect(jsonPath("$.bids[0].myMaxChf").doesNotExist())
                .andExpect(jsonPath("$.ownListing").value(false));
        mvc.perform(get("/api/listings/" + listing.getId() + "/auction").with(user("a")))
                .andExpect(jsonPath("$.leading").value(true)).andExpect(jsonPath("$.myMaxChf").value(300));
        mvc.perform(get("/api/listings").param("saleMode", "AUCTION"))
                .andExpect(jsonPath("$[?(@.id == " + listing.getId() + ")].currentBidChf").value(205));
    }

    @Test void sellerCannotBid() throws Exception {
        var listing = auction(Duration.ofDays(1));
        bid(listing, "seller", 200).andExpect(status().isForbidden());
        mvc.perform(get("/api/listings/" + listing.getId() + "/auction").with(user("seller")))
                .andExpect(jsonPath("$.ownListing").value(true));
    }

    @Test void bidBelowMinimumIsRejectedWithTheMinimum() throws Exception {
        var listing = auction(Duration.ofDays(1));
        bid(listing, "a", 99).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Your maximum must be at least CHF 100."));
        bid(listing, "a", 300).andExpect(status().isOk());
        bid(listing, "b", 104).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value(containsString("CHF 105")));
    }

    @Test void leaderCanRaiseButNotRepeatOrLowerTheirMaximum() throws Exception {
        var listing = auction(Duration.ofDays(1));
        bid(listing, "a", 300).andExpect(status().isOk());
        bid(listing, "a", 250).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("You already lead with a maximum of CHF 300."));
        bid(listing, "a", 300).andExpect(status().isBadRequest());
        bid(listing, "a", 400).andExpect(status().isOk())
                .andExpect(jsonPath("$.currentBidChf").value(100)).andExpect(jsonPath("$.myMaxChf").value(400))
                .andExpect(jsonPath("$.bidCount").value(1));
    }

    @Test void lateBidExtendsBy2Minutes() throws Exception {
        var listing = auction(Duration.ofSeconds(90));
        bid(listing, "a", 150).andExpect(status().isOk());
        assertThat(listings.findById(listing.getId()).orElseThrow().getEndsAt())
                .isAfter(Instant.now().plus(Duration.ofSeconds(110)));
    }

    @Test void bidAfterEndIsRejected() throws Exception {
        bid(auction(Duration.ofSeconds(-1)), "a", 150).andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("This auction has ended."));
    }

    @Test void anonymousGetHidesMaximaAndMine() throws Exception {
        var listing = auction(Duration.ofDays(1));
        bid(listing, "a", 300);
        bid(listing, "b", 200);
        String body = mvc.perform(get("/api/listings/" + listing.getId() + "/auction"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.myMaxChf").doesNotExist()).andExpect(jsonPath("$.leading").value(false))
                .andExpect(jsonPath("$.bids.length()").value(3))
                .andReturn().getResponse().getContentAsString();
        assertThat(body).doesNotContain("maxChf").doesNotContain("a-name");
    }

    @Test void closeJobMarksSoldOrEnded() throws Exception {
        var sold = auction(Duration.ofDays(1));
        bid(sold, "a", 150);
        bid(sold, "b", 100);
        sold.setEndsAt(Instant.now().minusSeconds(1));
        var unsold = auction(Duration.ofSeconds(-1));
        listings.flush();
        auctions.closeDue();
        assertThat(listings.findById(sold.getId()).orElseThrow().getStatus()).isEqualTo(ListingStatus.SOLD);
        assertThat(listings.findById(sold.getId()).orElseThrow().getBuyerId()).isEqualTo("a");
        assertThat(listings.findById(unsold.getId()).orElseThrow().getStatus()).isEqualTo(ListingStatus.ENDED);
        assertThat(listings.findById(unsold.getId()).orElseThrow().getBuyerId()).isNull();
    }

    @Test void fixedPriceListingHasNoAuction() throws Exception {
        mvc.perform(get("/api/listings/2301/auction")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("This listing is not an auction."));
    }

    @Test void biddingRequiresAuthentication() throws Exception {
        mvc.perform(post("/api/listings/1301/auction/bids").contentType(MediaType.APPLICATION_JSON)
                .content("{\"maxChf\":500}")).andExpect(status().isUnauthorized());
    }
}
