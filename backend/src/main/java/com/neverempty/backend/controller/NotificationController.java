package com.neverempty.backend.controller;

import com.neverempty.backend.model.UserSettings;
import com.neverempty.backend.service.NotificationService;
import com.neverempty.backend.service.SettingsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class NotificationController {

    private final SettingsService settingsService;
    private final NotificationService notificationService;

    @GetMapping("/notifications/settings")
    public ResponseEntity<UserSettings.NotificationConfig> getNotificationSettings(
            @AuthenticationPrincipal Jwt jwt) {
        var userId = jwt.getSubject();
        return ResponseEntity.ok(settingsService.getNotificationSettings(userId));
    }

    @PutMapping("/notifications/settings")
    public ResponseEntity<UserSettings.NotificationConfig> updateNotificationSettings(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody UserSettings.NotificationConfig config) {
        var userId = jwt.getSubject();
        var updated = settingsService.updateNotificationSettings(userId, config);
        return ResponseEntity.ok(updated);
    }

    @PostMapping("/notifications/send-digest")
    public ResponseEntity<Map<String, String>> sendDigest(@AuthenticationPrincipal Jwt jwt) {
        var userId = jwt.getSubject();
        var summary = notificationService.checkAndNotifyHousehold(userId);
        var notificationConfig = settingsService.getNotificationSettings(userId);
        if (notificationConfig.getEmail() != null && notificationConfig.isEnabled()) {
            notificationService.sendNotificationEmail(notificationConfig.getEmail(), summary);
        }
        return ResponseEntity.ok(Map.of("status", "digest sent"));
    }
}
