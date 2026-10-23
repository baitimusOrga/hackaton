package one.absent.hackaton.selling;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

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
class SellingControllerTest {
    private static final String REQUEST = """
        {"title":"Desk","description":"Solid wood desk","category":"Furniture","condition":"GOOD",
         "priceChf":80.50,"postcode":"8004","locality":"Zürich","attributes":{"Material":"Wood"},
         "photoIds":[],"sellerId":"forged","sellerName":"Impersonated seller"}
        """;
    @Autowired WebApplicationContext context;
    @Autowired ListingRepository listings;
    MockMvc mvc;

    @BeforeEach void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    @Test void publishingUsesVerifiedIdentityAndPersistsIt() throws Exception {
        long before = listings.count();
        mvc.perform(post("/api/listings").with(jwt().jwt(j -> j.subject("actual-seller")
                        .claim("name", "Verified Seller").claim("email", "seller@example.com")))
                        .contentType(MediaType.APPLICATION_JSON).content(REQUEST))
                .andExpect(status().isCreated())
                .andExpect(header().exists("Location"))
                .andExpect(jsonPath("$.sellerName").value("Verified Seller"));
        assertThat(listings.count()).isEqualTo(before + 1);
        var listing = listings.findAll().stream().filter(l -> "actual-seller".equals(l.getSellerId())).findFirst().orElseThrow();
        assertThat(listing.getSellerName()).isEqualTo("Verified Seller");
        mvc.perform(get("/api/listings/" + listing.getId()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.sellerName").value("Verified Seller"));
        mvc.perform(get("/api/listings")).andExpect(jsonPath("$[?(@.title == 'Desk')]").exists());
    }

    @Test void demoListingsHaveNoSeller() throws Exception {
        assertThat(listings.findById(1L).orElseThrow().getSellerId()).isNull();
        mvc.perform(get("/api/listings/1")).andExpect(status().isOk())
                .andExpect(jsonPath("$.sellerName").doesNotExist());
    }

    @Test void publishingRequiresAuthentication() throws Exception {
        mvc.perform(post("/api/listings").contentType(MediaType.APPLICATION_JSON).content(REQUEST))
                .andExpect(status().isUnauthorized());
    }

    @Test void invalidFieldsAndUnavailablePhotosAreRejected() throws Exception {
        var seller = jwt().jwt(j -> j.subject("seller").claim("name", "Seller").claim("email", "s@example.com"));
        mvc.perform(post("/api/listings").with(seller).contentType(MediaType.APPLICATION_JSON)
                        .content(REQUEST.replace("80.50", "-1")))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.priceChf").exists());
        mvc.perform(post("/api/listings").with(seller).contentType(MediaType.APPLICATION_JSON)
                        .content(REQUEST.replace("\"photoIds\":[]", "\"photoIds\":[123]")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Photo publishing is not available yet."));
    }
}
