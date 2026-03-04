package com.neverempty.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.neverempty.backend.dto.CreateItemRequest;
import com.neverempty.backend.dto.MarkConsumedRequest;
import com.neverempty.backend.dto.SetConsumptionRateRequest;
import com.neverempty.backend.model.Item;
import com.neverempty.backend.model.enums.ConsumerCategory;
import com.neverempty.backend.model.enums.ItemCategory;
import com.neverempty.backend.service.ItemService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ItemController.class)
class ItemControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private ItemService itemService;

    private static final String USER_ID = "user-1";

    private Item sampleItem() {
        return Item.builder()
                .id("i1")
                .userId(USER_ID)
                .name("Milk")
                .category(ItemCategory.FOOD)
                .currentQuantity(2.0)
                .unit("liters")
                .storeId("s1")
                .price(1.99)
                .consumerCategory(ConsumerCategory.ADULT)
                .monthlyConsumptionRate(8.0)
                .createdAt(Instant.parse("2025-01-15T10:00:00Z"))
                .updatedAt(Instant.parse("2025-01-15T10:00:00Z"))
                .build();
    }

    private CreateItemRequest sampleCreateRequest() {
        return new CreateItemRequest(
                "Milk",
                ItemCategory.FOOD,
                2.0,
                "liters",
                "s1",
                1.99,
                ConsumerCategory.ADULT,
                8.0
        );
    }

    // ---- GET /api/v1/items ----

    @Test
    void listItems_all() throws Exception {
        when(itemService.listItems(USER_ID, null, null)).thenReturn(List.of(sampleItem()));

        mockMvc.perform(get("/api/v1/items")
                        .with(jwt().jwt(j -> j.subject(USER_ID))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("i1"))
                .andExpect(jsonPath("$[0].name").value("Milk"))
                .andExpect(jsonPath("$[0].category").value("FOOD"));
    }

    @Test
    void listItems_byCategory() throws Exception {
        when(itemService.listItems(USER_ID, ItemCategory.CLEANING, null))
                .thenReturn(List.of());

        mockMvc.perform(get("/api/v1/items")
                        .param("category", "CLEANING")
                        .with(jwt().jwt(j -> j.subject(USER_ID))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$").isEmpty());
    }

    @Test
    void listItems_byStoreId() throws Exception {
        when(itemService.listItems(USER_ID, null, "s1")).thenReturn(List.of(sampleItem()));

        mockMvc.perform(get("/api/v1/items")
                        .param("storeId", "s1")
                        .with(jwt().jwt(j -> j.subject(USER_ID))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].storeId").value("s1"));
    }

    // ---- POST /api/v1/items ----

    @Test
    void createItem_returns201() throws Exception {
        when(itemService.createItem(eq(USER_ID), any(CreateItemRequest.class)))
                .thenReturn(sampleItem());

        mockMvc.perform(post("/api/v1/items")
                        .with(jwt().jwt(j -> j.subject(USER_ID)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(sampleCreateRequest())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value("i1"))
                .andExpect(jsonPath("$.name").value("Milk"))
                .andExpect(jsonPath("$.currentQuantity").value(2.0));
    }

    // ---- GET /api/v1/items/{itemId} ----

    @Test
    void getItem_found() throws Exception {
        when(itemService.getItem(USER_ID, "i1")).thenReturn(Optional.of(sampleItem()));

        mockMvc.perform(get("/api/v1/items/i1")
                        .with(jwt().jwt(j -> j.subject(USER_ID))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("i1"))
                .andExpect(jsonPath("$.name").value("Milk"));
    }

    @Test
    void getItem_notFound() throws Exception {
        when(itemService.getItem(USER_ID, "nonexistent")).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/v1/items/nonexistent")
                        .with(jwt().jwt(j -> j.subject(USER_ID))))
                .andExpect(status().isNotFound());
    }

    // ---- PUT /api/v1/items/{itemId} ----

    @Test
    void updateItem_found() throws Exception {
        var updated = sampleItem();
        updated.setName("Oat Milk");
        when(itemService.updateItem(eq(USER_ID), eq("i1"), any(CreateItemRequest.class)))
                .thenReturn(Optional.of(updated));

        mockMvc.perform(put("/api/v1/items/i1")
                        .with(jwt().jwt(j -> j.subject(USER_ID)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(sampleCreateRequest())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Oat Milk"));
    }

    @Test
    void updateItem_notFound() throws Exception {
        when(itemService.updateItem(eq(USER_ID), eq("nonexistent"), any(CreateItemRequest.class)))
                .thenReturn(Optional.empty());

        mockMvc.perform(put("/api/v1/items/nonexistent")
                        .with(jwt().jwt(j -> j.subject(USER_ID)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(sampleCreateRequest())))
                .andExpect(status().isNotFound());
    }

    // ---- DELETE /api/v1/items/{itemId} ----

    @Test
    void deleteItem_found() throws Exception {
        when(itemService.deleteItem(USER_ID, "i1")).thenReturn(true);

        mockMvc.perform(delete("/api/v1/items/i1")
                        .with(jwt().jwt(j -> j.subject(USER_ID))))
                .andExpect(status().isNoContent());
    }

    @Test
    void deleteItem_notFound() throws Exception {
        when(itemService.deleteItem(USER_ID, "nonexistent")).thenReturn(false);

        mockMvc.perform(delete("/api/v1/items/nonexistent")
                        .with(jwt().jwt(j -> j.subject(USER_ID))))
                .andExpect(status().isNotFound());
    }

    // ---- POST /api/v1/items/{itemId}/consumed ----

    @Test
    void markConsumed_found() throws Exception {
        var item = sampleItem();
        item.setCurrentQuantity(1.0);
        when(itemService.markConsumed(eq(USER_ID), eq("i1"), any(MarkConsumedRequest.class)))
                .thenReturn(Optional.of(item));

        var request = new MarkConsumedRequest(1.0, LocalDate.of(2025, 6, 15));

        mockMvc.perform(post("/api/v1/items/i1/consumed")
                        .with(jwt().jwt(j -> j.subject(USER_ID)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentQuantity").value(1.0));
    }

    @Test
    void markConsumed_notFound() throws Exception {
        when(itemService.markConsumed(eq(USER_ID), eq("nonexistent"), any(MarkConsumedRequest.class)))
                .thenReturn(Optional.empty());

        var request = new MarkConsumedRequest(1.0, null);

        mockMvc.perform(post("/api/v1/items/nonexistent/consumed")
                        .with(jwt().jwt(j -> j.subject(USER_ID)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isNotFound());
    }

    // ---- PUT /api/v1/items/{itemId}/consumption-rate ----

    @Test
    void setConsumptionRate_found() throws Exception {
        var item = sampleItem();
        item.setMonthlyConsumptionRate(12.0);
        when(itemService.setConsumptionRate(USER_ID, "i1", 12.0))
                .thenReturn(Optional.of(item));

        var request = new SetConsumptionRateRequest(12.0);

        mockMvc.perform(put("/api/v1/items/i1/consumption-rate")
                        .with(jwt().jwt(j -> j.subject(USER_ID)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.monthlyConsumptionRate").value(12.0));
    }

    @Test
    void setConsumptionRate_notFound() throws Exception {
        when(itemService.setConsumptionRate(USER_ID, "nonexistent", 5.0))
                .thenReturn(Optional.empty());

        var request = new SetConsumptionRateRequest(5.0);

        mockMvc.perform(put("/api/v1/items/nonexistent/consumption-rate")
                        .with(jwt().jwt(j -> j.subject(USER_ID)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isNotFound());
    }

    // ---- Unauthenticated ----

    @Test
    void unauthenticatedRequest_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/items"))
                .andExpect(status().isUnauthorized());
    }
}
