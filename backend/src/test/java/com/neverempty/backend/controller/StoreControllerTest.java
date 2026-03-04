package com.neverempty.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.neverempty.backend.model.Store;
import com.neverempty.backend.service.StoreService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(StoreController.class)
class StoreControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private StoreService storeService;

    private static final String USER_ID = "user-1";

    private Store sampleStore() {
        return Store.builder()
                .id("s1")
                .userId(USER_ID)
                .name("Lidl")
                .visitIntervalDays(7)
                .lastVisitDate(LocalDate.of(2025, 6, 1))
                .build();
    }

    // ---- GET /api/v1/stores ----

    @Test
    void listStores() throws Exception {
        var store = sampleStore();
        when(storeService.listStores(USER_ID)).thenReturn(List.of(store));

        mockMvc.perform(get("/api/v1/stores")
                        .with(jwt().jwt(j -> j.subject(USER_ID))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("s1"))
                .andExpect(jsonPath("$[0].name").value("Lidl"))
                .andExpect(jsonPath("$[0].visitIntervalDays").value(7));
    }

    // ---- POST /api/v1/stores ----

    @Test
    void createStore_returns201() throws Exception {
        var created = sampleStore();
        when(storeService.createStore(eq(USER_ID), any(Store.class))).thenReturn(created);

        var requestBody = Store.builder()
                .name("Lidl")
                .visitIntervalDays(7)
                .lastVisitDate(LocalDate.of(2025, 6, 1))
                .build();

        mockMvc.perform(post("/api/v1/stores")
                        .with(jwt().jwt(j -> j.subject(USER_ID)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(requestBody)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value("s1"))
                .andExpect(jsonPath("$.name").value("Lidl"));
    }

    // ---- GET /api/v1/stores/{storeId} ----

    @Test
    void getStore_found() throws Exception {
        when(storeService.getStore(USER_ID, "s1")).thenReturn(Optional.of(sampleStore()));

        mockMvc.perform(get("/api/v1/stores/s1")
                        .with(jwt().jwt(j -> j.subject(USER_ID))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("s1"))
                .andExpect(jsonPath("$.name").value("Lidl"));
    }

    @Test
    void getStore_notFound() throws Exception {
        when(storeService.getStore(USER_ID, "nonexistent")).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/v1/stores/nonexistent")
                        .with(jwt().jwt(j -> j.subject(USER_ID))))
                .andExpect(status().isNotFound());
    }

    // ---- PUT /api/v1/stores/{storeId} ----

    @Test
    void updateStore_found() throws Exception {
        var updated = sampleStore();
        updated.setName("Aldi");
        when(storeService.updateStore(eq(USER_ID), eq("s1"), any(Store.class)))
                .thenReturn(Optional.of(updated));

        mockMvc.perform(put("/api/v1/stores/s1")
                        .with(jwt().jwt(j -> j.subject(USER_ID)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updated)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Aldi"));
    }

    @Test
    void updateStore_notFound() throws Exception {
        when(storeService.updateStore(eq(USER_ID), eq("nonexistent"), any(Store.class)))
                .thenReturn(Optional.empty());

        var body = sampleStore();
        mockMvc.perform(put("/api/v1/stores/nonexistent")
                        .with(jwt().jwt(j -> j.subject(USER_ID)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isNotFound());
    }

    // ---- DELETE /api/v1/stores/{storeId} ----

    @Test
    void deleteStore_found() throws Exception {
        when(storeService.deleteStore(USER_ID, "s1")).thenReturn(true);

        mockMvc.perform(delete("/api/v1/stores/s1")
                        .with(jwt().jwt(j -> j.subject(USER_ID))))
                .andExpect(status().isNoContent());
    }

    @Test
    void deleteStore_notFound() throws Exception {
        when(storeService.deleteStore(USER_ID, "nonexistent")).thenReturn(false);

        mockMvc.perform(delete("/api/v1/stores/nonexistent")
                        .with(jwt().jwt(j -> j.subject(USER_ID))))
                .andExpect(status().isNotFound());
    }

    // ---- Unauthenticated ----

    @Test
    void unauthenticatedRequest_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/stores"))
                .andExpect(status().isUnauthorized());
    }
}
