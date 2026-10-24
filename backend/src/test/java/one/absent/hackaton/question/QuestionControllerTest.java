package one.absent.hackaton.question;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import one.absent.hackaton.listing.Condition;
import one.absent.hackaton.listing.Listing;
import one.absent.hackaton.listing.ListingRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class QuestionControllerTest {
    @Autowired WebApplicationContext context;
    @Autowired ListingRepository listings;
    MockMvc mvc;

    @BeforeEach void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    @Test void onlyTheSellerAnswers() throws Exception {
        var listing = new Listing();
        listing.setTitle("Desk");
        listing.setDescription("Solid wood desk");
        listing.setPriceChf(java.math.BigDecimal.TEN);
        listing.setCondition(Condition.GOOD);
        listing.setCategory("Office furniture");
        listing.setPostcode("8004");
        listing.setLocality("Zürich");
        listing.setCreatedAt(java.time.Instant.now());
        listing.setSellerId("seller");
        long id = listings.save(listing).getId();
        String base = "/api/listings/" + id + "/questions";
        var buyer = jwt().jwt(j -> j.subject("buyer").claim("name", "Buyer"));
        var seller = jwt().jwt(j -> j.subject("seller").claim("name", "Seller"));

        mvc.perform(post(base).contentType(MediaType.APPLICATION_JSON).content("{\"text\":\"Still there?\"}"))
                .andExpect(status().isUnauthorized());
        String created = mvc.perform(post(base).with(buyer).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"text\":\"Still there?\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.askerName").value("Buyer"))
                .andReturn().getResponse().getContentAsString();
        long qid = Long.parseLong(created.replaceAll(".*\"id\":(\\d+).*", "$1"));
        String answer = base + "/" + qid + "/answer";

        mvc.perform(put(answer).with(buyer).contentType(MediaType.APPLICATION_JSON).content("{\"answer\":\"Yes\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(put(answer).with(seller).contentType(MediaType.APPLICATION_JSON).content("{\"answer\":\"Yes\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.answer").value("Yes"));

        mvc.perform(get(base)).andExpect(status().isOk()).andExpect(jsonPath("$[0].answer").value("Yes"))
                .andExpect(jsonPath("$[0].canAnswer").value(false));
        mvc.perform(get(base).with(seller)).andExpect(jsonPath("$[0].canAnswer").value(true));
    }
}
