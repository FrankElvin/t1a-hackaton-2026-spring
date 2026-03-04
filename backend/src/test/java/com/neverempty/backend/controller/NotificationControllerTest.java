package com.neverempty.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.neverempty.backend.model.UserSettings;
import com.neverempty.backend.model.enums.NotificationChannel;
import com.neverempty.backend.service.NotificationService;
import com.neverempty.backend.service.NotificationService.NotificationSummary;
import com.neverempty.backend.service.NotificationService.ProductAlert;
import com.neverempty.backend.service.SettingsService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(NotificationController.class)
class NotificationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private SettingsService settingsService;

    @MockitoBean
    private NotificationService notificationService;

    @Test
    void getNotificationSettings_returnsConfig() throws Exception {
        var config = new UserSettings.NotificationConfig(
                NotificationChannel.EMAIL, "user@example.com", true, 5, 7);
        when(settingsService.getNotificationSettings("user-1")).thenReturn(config);

        mockMvc.perform(get("/api/v1/notifications/settings")
                        .with(jwt().jwt(j -> j.subject("user-1"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.channel").value("EMAIL"))
                .andExpect(jsonPath("$.email").value("user@example.com"))
                .andExpect(jsonPath("$.enabled").value(true))
                .andExpect(jsonPath("$.notifyDaysBeforeDepletion").value(5))
                .andExpect(jsonPath("$.lookAheadDays").value(7));

        verify(settingsService).getNotificationSettings("user-1");
    }

    @Test
    void updateNotificationSettings_returnsUpdated() throws Exception {
        var config = new UserSettings.NotificationConfig(
                NotificationChannel.EMAIL, "new@example.com", false, 3, 14);
        when(settingsService.updateNotificationSettings("user-1", config)).thenReturn(config);

        mockMvc.perform(put("/api/v1/notifications/settings")
                        .with(jwt().jwt(j -> j.subject("user-1")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(config)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.channel").value("EMAIL"))
                .andExpect(jsonPath("$.email").value("new@example.com"))
                .andExpect(jsonPath("$.enabled").value(false))
                .andExpect(jsonPath("$.notifyDaysBeforeDepletion").value(3))
                .andExpect(jsonPath("$.lookAheadDays").value(14));

        verify(settingsService).updateNotificationSettings(eq("user-1"), any(UserSettings.NotificationConfig.class));
    }

    @Test
    void sendDigest_sendsEmailWhenEnabled() throws Exception {
        var summary = new NotificationSummary(
                List.of(new ProductAlert("p1", "Milk", 2)),
                List.of(new ProductAlert("p2", "Eggs", 1))
        );
        var config = new UserSettings.NotificationConfig(
                NotificationChannel.EMAIL, "user@example.com", true, 5, 7);

        when(notificationService.checkAndNotifyHousehold("user-1")).thenReturn(summary);
        when(settingsService.getNotificationSettings("user-1")).thenReturn(config);

        mockMvc.perform(post("/api/v1/notifications/send-digest")
                        .with(jwt().jwt(j -> j.subject("user-1"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("digest sent"));

        verify(notificationService).checkAndNotifyHousehold("user-1");
        verify(notificationService).sendNotificationEmail("user@example.com", summary);
    }

    @Test
    void sendDigest_skipsEmailWhenDisabled() throws Exception {
        var summary = new NotificationSummary(
                List.of(new ProductAlert("p1", "Milk", 2)),
                List.of()
        );
        var config = new UserSettings.NotificationConfig(
                NotificationChannel.EMAIL, "user@example.com", false, 5, 7);

        when(notificationService.checkAndNotifyHousehold("user-1")).thenReturn(summary);
        when(settingsService.getNotificationSettings("user-1")).thenReturn(config);

        mockMvc.perform(post("/api/v1/notifications/send-digest")
                        .with(jwt().jwt(j -> j.subject("user-1"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("digest sent"));

        verify(notificationService).checkAndNotifyHousehold("user-1");
        verify(notificationService, never()).sendNotificationEmail(any(), any());
    }

    @Test
    void unauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/notifications/settings"))
                .andExpect(status().isUnauthorized());
    }
}
