package com.neverempty.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.neverempty.backend.dto.DashboardSummary;
import com.neverempty.backend.dto.ItemForecast;
import com.neverempty.backend.service.DashboardService;
import com.neverempty.backend.service.SettingsService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.List;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(DashboardController.class)
class DashboardControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private DashboardService dashboardService;

    @MockitoBean
    private SettingsService settingsService;

    private static ItemForecast sampleForecast(String id, String name, int daysUntil) {
        return new ItemForecast(
                id,
                name,
                5.0,
                "pcs",
                1.0,
                LocalDate.of(2026, 3, 10),
                daysUntil,
                50.0,
                LocalDate.of(2026, 3, 1)
        );
    }

    @Test
    void getDashboard_returnsSummary() throws Exception {
        var critical = List.of(sampleForecast("i1", "Milk", 2));
        var upcoming = List.of(sampleForecast("i2", "Bread", 15));
        var all = List.of(sampleForecast("i1", "Milk", 2), sampleForecast("i2", "Bread", 15));
        var summary = new DashboardSummary(LocalDate.of(2026, 3, 1), critical, upcoming, all);

        when(dashboardService.getDashboard("user-1")).thenReturn(summary);

        mockMvc.perform(get("/api/v1/dashboard")
                        .with(jwt().jwt(j -> j.subject("user-1"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.calculationDate").value("2026-03-01"))
                .andExpect(jsonPath("$.criticalItems.length()").value(1))
                .andExpect(jsonPath("$.criticalItems[0].itemId").value("i1"))
                .andExpect(jsonPath("$.criticalItems[0].itemName").value("Milk"))
                .andExpect(jsonPath("$.upcomingPurchases.length()").value(1))
                .andExpect(jsonPath("$.upcomingPurchases[0].itemId").value("i2"))
                .andExpect(jsonPath("$.stockLevels.length()").value(2));

        verify(dashboardService).getDashboard("user-1");
    }

    @Test
    void getStockLevels_returnsList() throws Exception {
        var levels = List.of(
                sampleForecast("i1", "Milk", 2),
                sampleForecast("i2", "Bread", 15)
        );
        when(dashboardService.getStockLevels("user-1")).thenReturn(levels);

        mockMvc.perform(get("/api/v1/dashboard/stock-levels")
                        .with(jwt().jwt(j -> j.subject("user-1"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].itemId").value("i1"))
                .andExpect(jsonPath("$[0].itemName").value("Milk"))
                .andExpect(jsonPath("$[0].currentQuantity").value(5.0))
                .andExpect(jsonPath("$[0].unit").value("pcs"))
                .andExpect(jsonPath("$[0].estimatedDailyConsumption").value(1.0))
                .andExpect(jsonPath("$[0].estimatedDepletionDate").value("2026-03-10"))
                .andExpect(jsonPath("$[0].daysUntilDepletion").value(2))
                .andExpect(jsonPath("$[0].percentRemaining").value(50.0))
                .andExpect(jsonPath("$[0].calculationDate").value("2026-03-01"))
                .andExpect(jsonPath("$[1].itemId").value("i2"));

        verify(dashboardService).getStockLevels("user-1");
    }

    @Test
    void getUpcomingPurchases_defaultDays() throws Exception {
        var purchases = List.of(sampleForecast("i2", "Bread", 15));
        when(dashboardService.getUpcomingPurchases("user-1", 30)).thenReturn(purchases);

        mockMvc.perform(get("/api/v1/dashboard/upcoming-purchases")
                        .with(jwt().jwt(j -> j.subject("user-1"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].itemId").value("i2"))
                .andExpect(jsonPath("$[0].itemName").value("Bread"));

        verify(dashboardService).getUpcomingPurchases("user-1", 30);
    }

    @Test
    void getUpcomingPurchases_customDays() throws Exception {
        var purchases = List.of(sampleForecast("i3", "Rice", 10));
        when(dashboardService.getUpcomingPurchases("user-1", 14)).thenReturn(purchases);

        mockMvc.perform(get("/api/v1/dashboard/upcoming-purchases")
                        .param("withinDays", "14")
                        .with(jwt().jwt(j -> j.subject("user-1"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].itemId").value("i3"))
                .andExpect(jsonPath("$[0].itemName").value("Rice"));

        verify(dashboardService).getUpcomingPurchases("user-1", 14);
    }

    @Test
    void unauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/dashboard"))
                .andExpect(status().isUnauthorized());
    }
}
