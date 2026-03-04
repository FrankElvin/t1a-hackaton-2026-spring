package com.neverempty.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.neverempty.backend.config.SecurityConfig;
import com.neverempty.backend.dto.ForecastResponse;
import com.neverempty.backend.dto.ItemForecast;
import com.neverempty.backend.service.ForecastService;
import com.neverempty.backend.service.SettingsService;
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

@WebMvcTest(ForecastController.class)
@Import(SecurityConfig.class)
class ForecastControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private ForecastService forecastService;

    @MockitoBean
    private SettingsService settingsService;

    private static final LocalDate CALC_DATE = LocalDate.of(2026, 3, 4);

    @Test
    void getForecast_returnsResponse() throws Exception {
        ItemForecast forecast = new ItemForecast(
                "item-1",
                "Milk",
                2.0,
                "pcs",
                0.133,
                LocalDate.of(2026, 3, 19),
                15,
                2.0,
                CALC_DATE
        );

        ForecastResponse response = new ForecastResponse(CALC_DATE, List.of(forecast));

        when(settingsService.getCalculationDate("user-1")).thenReturn(CALC_DATE);
        when(forecastService.getForecast("user-1", CALC_DATE)).thenReturn(response);

        mockMvc.perform(get("/api/v1/forecast")
                        .with(jwt().jwt(j -> j.subject("user-1"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.calculationDate").value("2026-03-04"))
                .andExpect(jsonPath("$.items").isArray())
                .andExpect(jsonPath("$.items[0].itemId").value("item-1"))
                .andExpect(jsonPath("$.items[0].itemName").value("Milk"))
                .andExpect(jsonPath("$.items[0].currentQuantity").value(2.0))
                .andExpect(jsonPath("$.items[0].unit").value("pcs"))
                .andExpect(jsonPath("$.items[0].daysUntilDepletion").value(15))
                .andExpect(jsonPath("$.items[0].percentRemaining").value(2.0));
    }

    @Test
    void getItemForecast_found() throws Exception {
        ItemForecast forecast = new ItemForecast(
                "item-1",
                "Milk",
                2.0,
                "pcs",
                0.133,
                LocalDate.of(2026, 3, 19),
                15,
                2.0,
                CALC_DATE
        );

        when(settingsService.getCalculationDate("user-1")).thenReturn(CALC_DATE);
        when(forecastService.getItemForecast("user-1", "item-1", CALC_DATE))
                .thenReturn(Optional.of(forecast));

        mockMvc.perform(get("/api/v1/forecast/item-1")
                        .with(jwt().jwt(j -> j.subject("user-1"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.itemId").value("item-1"))
                .andExpect(jsonPath("$.itemName").value("Milk"))
                .andExpect(jsonPath("$.currentQuantity").value(2.0))
                .andExpect(jsonPath("$.daysUntilDepletion").value(15));
    }

    @Test
    void getItemForecast_notFound() throws Exception {
        when(settingsService.getCalculationDate("user-1")).thenReturn(CALC_DATE);
        when(forecastService.getItemForecast("user-1", "nonexistent", CALC_DATE))
                .thenReturn(Optional.empty());

        mockMvc.perform(get("/api/v1/forecast/nonexistent")
                        .with(jwt().jwt(j -> j.subject("user-1"))))
                .andExpect(status().isNotFound());
    }

    @Test
    void getForecast_unauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/forecast"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void getItemForecast_unauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/forecast/item-1"))
                .andExpect(status().isUnauthorized());
    }
}
