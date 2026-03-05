package com.neverempty.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.neverempty.backend.config.AppProperties;
import com.neverempty.backend.service.SettingsService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.Map;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(SettingsController.class)
class SettingsControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private SettingsService settingsService;

    @MockitoBean
    private AppProperties appProperties;

    @Test
    void getForwardEmail_returnsEmailFromConfig() throws Exception {
        when(appProperties.google()).thenReturn(
                new AppProperties.Google("", "inbox@t1aclmllmagents.click"));

        mockMvc.perform(get("/api/v1/settings/forward-email")
                        .with(jwt().jwt(j -> j.subject("user-1"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.forwardEmail").value("inbox@t1aclmllmagents.click"));
    }

    @Test
    void getCalculationDate_returnsDate() throws Exception {
        LocalDate date = LocalDate.of(2026, 3, 1);
        when(settingsService.getCalculationDate("user-1")).thenReturn(date);

        mockMvc.perform(get("/api/v1/settings/calculation-date")
                        .with(jwt().jwt(j -> j.subject("user-1"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.calculationDate").value("2026-03-01"));

        verify(settingsService).getCalculationDate("user-1");
    }

    @Test
    void setCalculationDate_updatesAndReturns() throws Exception {
        LocalDate date = LocalDate.of(2026, 4, 15);
        Map<String, LocalDate> body = Map.of("calculationDate", date);

        mockMvc.perform(put("/api/v1/settings/calculation-date")
                        .with(jwt().jwt(j -> j.subject("user-1")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.calculationDate").value("2026-04-15"));

        verify(settingsService).setCalculationDate("user-1", date);
    }

    @Test
    void unauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/settings/calculation-date"))
                .andExpect(status().isUnauthorized());
    }
}
