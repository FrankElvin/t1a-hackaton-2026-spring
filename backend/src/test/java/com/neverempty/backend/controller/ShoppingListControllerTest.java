package com.neverempty.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.neverempty.backend.config.SecurityConfig;
import com.neverempty.backend.dto.ShoppingList;
import com.neverempty.backend.dto.ShoppingListEntry;
import com.neverempty.backend.dto.ShoppingListsResponse;
import com.neverempty.backend.service.SettingsService;
import com.neverempty.backend.service.ShoppingListService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ShoppingListController.class)
@Import(SecurityConfig.class)
class ShoppingListControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private ShoppingListService shoppingListService;

    @MockitoBean
    private SettingsService settingsService;

    private static final LocalDate CALC_DATE = LocalDate.of(2026, 3, 4);

    @Test
    void getShoppingLists_returnsResponse() throws Exception {
        ShoppingListEntry entry = new ShoppingListEntry(
                "item-1",
                "Milk",
                2.0,
                "pcs",
                3.99,
                LocalDate.of(2026, 3, 10),
                true
        );

        ShoppingList list = new ShoppingList(
                "store-1",
                "Grocery Store",
                LocalDate.of(2026, 3, 11),
                List.of(entry),
                3.99
        );

        ShoppingListsResponse response = new ShoppingListsResponse(CALC_DATE, List.of(list));

        when(settingsService.getCalculationDate("user-1")).thenReturn(CALC_DATE);
        when(shoppingListService.getShoppingLists("user-1", CALC_DATE)).thenReturn(response);

        mockMvc.perform(get("/api/v1/shopping-lists")
                        .with(jwt().jwt(j -> j.subject("user-1"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.calculationDate").value("2026-03-04"))
                .andExpect(jsonPath("$.lists").isArray())
                .andExpect(jsonPath("$.lists[0].storeId").value("store-1"))
                .andExpect(jsonPath("$.lists[0].storeName").value("Grocery Store"))
                .andExpect(jsonPath("$.lists[0].nextVisitDate").value("2026-03-11"))
                .andExpect(jsonPath("$.lists[0].totalEstimatedCost").value(3.99))
                .andExpect(jsonPath("$.lists[0].entries[0].itemId").value("item-1"))
                .andExpect(jsonPath("$.lists[0].entries[0].itemName").value("Milk"))
                .andExpect(jsonPath("$.lists[0].entries[0].requiredQuantity").value(2.0))
                .andExpect(jsonPath("$.lists[0].entries[0].unit").value("pcs"))
                .andExpect(jsonPath("$.lists[0].entries[0].price").value(3.99))
                .andExpect(jsonPath("$.lists[0].entries[0].urgent").value(true));
    }

    @Test
    void getShoppingListByStore_found() throws Exception {
        ShoppingListEntry entry = new ShoppingListEntry(
                "item-1",
                "Milk",
                2.0,
                "pcs",
                3.99,
                LocalDate.of(2026, 3, 10),
                false
        );

        ShoppingList list = new ShoppingList(
                "store-1",
                "Grocery Store",
                LocalDate.of(2026, 3, 11),
                List.of(entry),
                3.99
        );

        when(settingsService.getCalculationDate("user-1")).thenReturn(CALC_DATE);
        when(shoppingListService.getShoppingListByStore("user-1", "store-1", CALC_DATE))
                .thenReturn(Optional.of(list));

        mockMvc.perform(get("/api/v1/shopping-lists/store-1")
                        .with(jwt().jwt(j -> j.subject("user-1"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.storeId").value("store-1"))
                .andExpect(jsonPath("$.storeName").value("Grocery Store"))
                .andExpect(jsonPath("$.nextVisitDate").value("2026-03-11"))
                .andExpect(jsonPath("$.totalEstimatedCost").value(3.99))
                .andExpect(jsonPath("$.entries").isArray())
                .andExpect(jsonPath("$.entries[0].itemId").value("item-1"))
                .andExpect(jsonPath("$.entries[0].urgent").value(false));
    }

    @Test
    void getShoppingListByStore_notFound() throws Exception {
        when(settingsService.getCalculationDate("user-1")).thenReturn(CALC_DATE);
        when(shoppingListService.getShoppingListByStore("user-1", "nonexistent", CALC_DATE))
                .thenReturn(Optional.empty());

        mockMvc.perform(get("/api/v1/shopping-lists/nonexistent")
                        .with(jwt().jwt(j -> j.subject("user-1"))))
                .andExpect(status().isNotFound());
    }

    @Test
    void getShoppingLists_unauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/shopping-lists"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void getShoppingListByStore_unauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/shopping-lists/store-1"))
                .andExpect(status().isUnauthorized());
    }
}
