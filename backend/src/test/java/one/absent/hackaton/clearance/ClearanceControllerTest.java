package one.absent.hackaton.clearance;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.time.LocalDate;
import java.util.List;

import one.absent.hackaton.ai.AiClient;
import one.absent.hackaton.clearance.ClearanceService.AiInventory;
import one.absent.hackaton.clearance.ClearanceService.AiItem;
import one.absent.hackaton.listing.Condition;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class ClearanceControllerTest {
    private static final String BASE = "/api/clearance/projects";
    @Autowired WebApplicationContext context;
    @Autowired JsonMapper json;
    @MockitoBean AiClient ai;
    MockMvc mvc;

    @BeforeEach void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    private static RequestPostProcessor owner() {
        return jwt().jwt(j -> j.subject("company"));
    }

    private static MockMultipartFile text(String value) {
        return new MockMultipartFile("text", "", "text/plain", value.getBytes());
    }

    private long createProject(int daysAhead) throws Exception {
        String body = """
                {"companyName":"Muster Treuhand AG","postcode":"8004","locality":"Zürich","deadline":"%s"}
                """.formatted(LocalDate.now().plusDays(daysAhead));
        String response = mvc.perform(post(BASE).with(owner()).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(response).path("id").asLong();
    }

    private String extract(long id) throws Exception {
        when(ai.ask(anyString(), anyString(), anyList(), anyString(), eq(AiInventory.class)))
                .thenReturn(new AiInventory(List.of(
                        new AiItem("Dell P2419H 24\" monitors", "Dell", "P2419H", "Monitors", 12, Condition.GOOD, "with stands"),
                        new AiItem("Height-adjustable desks", null, null, "Office furniture", 6, Condition.USED, " "))));
        return mvc.perform(multipart(BASE + "/" + id + "/items/extract").file(text("12;Dell P2419H;good"))
                        .with(owner()))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
    }

    private void setPrice(long id, long itemId, String price) throws Exception {
        String update = """
                {"name":"Dell monitors","category":"Monitors","quantity":12,"quantityConfirmed":true,
                 "condition":"GOOD","notes":"","unitPriceChf":%s}
                """.formatted(price);
        mvc.perform(put(BASE + "/" + id + "/items/" + itemId).with(owner())
                        .contentType(MediaType.APPLICATION_JSON).content(update))
                .andExpect(status().isOk());
    }

    private long firstItemId(String detail) {
        return json.readTree(detail).path("items").get(0).path("id").asLong();
    }

    @Test void projectsRequireLogin() throws Exception {
        mvc.perform(get(BASE)).andExpect(status().isUnauthorized());
        mvc.perform(post(BASE + "/1/publish").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test void otherUsersProjectIsNotFound() throws Exception {
        long id = createProject(30);
        mvc.perform(get(BASE + "/" + id).with(jwt().jwt(j -> j.subject("someone-else"))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("Clearance project not found."));
        mvc.perform(get(BASE).with(jwt().jwt(j -> j.subject("someone-else"))))
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test void extractAddsProvisionalItemsWithEstimates() throws Exception {
        long id = createProject(30);
        extract(id);
        mvc.perform(get(BASE + "/" + id).with(owner()))
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.items[0].quantityConfirmed").value(false))
                .andExpect(jsonPath("$.items[0].status").value("DRAFT"))
                .andExpect(jsonPath("$.items[0].estimatedUnitChf").isNumber())
                .andExpect(jsonPath("$.items[1].notes").doesNotExist())
                .andExpect(jsonPath("$.totals.itemLines").value(2))
                .andExpect(jsonPath("$.totals.units").value(18))
                .andExpect(jsonPath("$.routes.length()").value(3))
                .andExpect(jsonPath("$.recommendedRoute").value("MANAGED"));
    }

    @Test void brandAndModelPriceFromSameModelAndUnknownCategoryIsReplaced() throws Exception {
        long id = createProject(30);
        when(ai.ask(anyString(), anyString(), anyList(), anyString(), eq(AiInventory.class)))
                .thenReturn(new AiInventory(List.of(
                        new AiItem("Herman Miller Aeron Bürostuhl", "Herman Miller", "Aeron", "Office furniture", 20,
                                Condition.USED, null),
                        new AiItem("HP LaserJet Pro M404dn", "HP", "M404dn", "Printers", 3, Condition.USED, null))));
        mvc.perform(multipart(BASE + "/" + id + "/items/extract").file(text("20 Aeron; 3 HP printers")).with(owner()))
                .andExpect(status().isOk())
                // the V4 demo Aeron (USED) asks CHF 380, instead of the CHF 150 × 0.8 category fallback
                .andExpect(jsonPath("$.items[0].estimatedUnitChf").value(380))
                .andExpect(jsonPath("$.items[1].category").value("Household"));
    }

    @Test void extractWithoutTextOrPhotosIsBadRequest() throws Exception {
        long id = createProject(30);
        mvc.perform(multipart(BASE + "/" + id + "/items/extract").file(text("  ")).with(owner()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Paste an inventory list or add photos."));
        mvc.perform(multipart(BASE + "/" + id + "/items/extract")
                        .file(new MockMultipartFile("photos", "a.pdf", "application/pdf", new byte[] {1}))
                        .with(owner()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Photos must be JPEG, PNG, GIF or WebP images."));
        mvc.perform(multipart(BASE + "/" + id + "/items/extract")
                        .file(new MockMultipartFile("photos", "a.jpg", null, new byte[] {1}))
                        .with(owner()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Photos must be JPEG, PNG, GIF or WebP images."));
    }

    @Test void unknownCategoryOnUpdateIsBadRequest() throws Exception {
        long id = createProject(30);
        long itemId = firstItemId(extract(id));
        String update = """
                {"name":"Dell monitors","category":"Weapons","quantity":10,"quantityConfirmed":false,
                 "condition":"USED","notes":""}
                """;
        mvc.perform(put(BASE + "/" + id + "/items/" + itemId).with(owner())
                        .contentType(MediaType.APPLICATION_JSON).content(update))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Choose one of the listed categories."));
    }

    @Test void updateItemAndConfirmQuantities() throws Exception {
        long id = createProject(30);
        long itemId = firstItemId(extract(id));
        String update = """
                {"name":"Dell monitors","category":"Monitors","quantity":10,"quantityConfirmed":false,
                 "condition":"USED","notes":""}
                """;
        mvc.perform(put(BASE + "/" + id + "/items/" + itemId).with(owner())
                        .contentType(MediaType.APPLICATION_JSON).content(update))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].name").value("Dell monitors"))
                .andExpect(jsonPath("$.items[0].quantity").value(10))
                .andExpect(jsonPath("$.items[0].notes").doesNotExist());
        mvc.perform(post(BASE + "/" + id + "/items/confirm").with(owner()))
                .andExpect(jsonPath("$.items[0].quantityConfirmed").value(true))
                .andExpect(jsonPath("$.items[1].quantityConfirmed").value(true));
        mvc.perform(delete(BASE + "/" + id + "/items/" + itemId).with(owner()))
                .andExpect(jsonPath("$.items.length()").value(1));
        mvc.perform(delete(BASE + "/" + id + "/items/" + itemId).with(owner()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("Item not found."));
    }

    @Test void publishRequiresSelfServiceAndConfirmedQuantities() throws Exception {
        long id = createProject(30);
        long itemId = firstItemId(extract(id));
        String publish = "{\"itemIds\":[" + itemId + "]}";
        mvc.perform(post(BASE + "/" + id + "/publish").with(owner())
                        .contentType(MediaType.APPLICATION_JSON).content(publish))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("Choose Self-service to publish listings yourself."));
        mvc.perform(put(BASE + "/" + id + "/route").with(owner())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"route\":\"SELF_SERVICE\"}"))
                .andExpect(jsonPath("$.route").value("SELF_SERVICE"));
        mvc.perform(post(BASE + "/" + id + "/publish").with(owner())
                        .contentType(MediaType.APPLICATION_JSON).content(publish))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("Please confirm the quantity of Dell P2419H 24\" monitors first."));
        mvc.perform(post(BASE + "/" + id + "/items/confirm").with(owner())).andExpect(status().isOk());
        mvc.perform(post(BASE + "/" + id + "/publish").with(owner())
                        .contentType(MediaType.APPLICATION_JSON).content(publish))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("Please set the price per piece of Dell P2419H 24\" monitors "
                        + "first; the estimate is only a suggestion."));
    }

    @Test void publishCreatesListingsWithCompanyAsSeller() throws Exception {
        long id = createProject(30);
        String detail = extract(id);
        long itemId = firstItemId(detail);
        mvc.perform(put(BASE + "/" + id + "/route").with(owner())
                .contentType(MediaType.APPLICATION_JSON).content("{\"route\":\"SELF_SERVICE\"}"));
        setPrice(id, itemId, "77.50");
        mvc.perform(post(BASE + "/" + id + "/items/confirm").with(owner()))
                .andExpect(jsonPath("$.items[0].unitPriceChf").value(77.5))
                .andExpect(jsonPath("$.items[0].priceConfirmed").value(true))
                .andExpect(jsonPath("$.items[0].estimatedTotalChf").value(930))
                .andExpect(jsonPath("$.items[1].priceConfirmed").value(false));
        String publish = "{\"itemIds\":[" + itemId + "]}";
        String response = mvc.perform(post(BASE + "/" + id + "/publish").with(owner())
                        .contentType(MediaType.APPLICATION_JSON).content(publish))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].status").value("LISTED"))
                .andExpect(jsonPath("$.items[1].status").value("DRAFT"))
                .andExpect(jsonPath("$.totals.listed").value(1))
                .andExpect(jsonPath("$.totals.draft").value(1))
                .andReturn().getResponse().getContentAsString();
        long listingId = json.readTree(response).path("items").get(0).path("listingId").asLong();

        mvc.perform(get("/api/listings/" + listingId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sellerName").value("Muster Treuhand AG"))
                .andExpect(jsonPath("$.priceChf").value(77.5))
                .andExpect(jsonPath("$.postcode").value("8004"));
        mvc.perform(get("/api/listings"))
                .andExpect(jsonPath("$[?(@.id == %d)]".formatted(listingId)).exists());
        // a listed item cannot be published again or changed
        mvc.perform(post(BASE + "/" + id + "/publish").with(owner())
                        .contentType(MediaType.APPLICATION_JSON).content(publish))
                .andExpect(status().isConflict());
        mvc.perform(delete(BASE + "/" + id + "/items/" + itemId).with(owner()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("This item is already listed."));
    }
}
