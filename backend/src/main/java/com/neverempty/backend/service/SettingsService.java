package com.neverempty.backend.service;

import com.neverempty.backend.model.UserSettings;
import com.neverempty.backend.repository.UserSettingsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;

@Service
@RequiredArgsConstructor
public class SettingsService {

    private final UserSettingsRepository repository;

    public UserSettings getSettings(String userId) {
        return repository.findByUserId(userId)
                .orElseGet(() -> {
                    var settings = UserSettings.builder()
                            .userId(userId)
                            .notification(new UserSettings.NotificationConfig())
                            .build();
                    return repository.save(settings);
                });
    }

    public LocalDate getCalculationDate(String userId) {
        var settings = getSettings(userId);
        return settings.getCalculationDate() != null
                ? settings.getCalculationDate()
                : LocalDate.now();
    }

    public UserSettings setCalculationDate(String userId, LocalDate date) {
        var settings = getSettings(userId);
        settings.setCalculationDate(date);
        return repository.save(settings);
    }

    public UserSettings.NotificationConfig getNotificationSettings(String userId) {
        var settings = getSettings(userId);
        return settings.getNotification() != null
                ? settings.getNotification()
                : new UserSettings.NotificationConfig();
    }

    public UserSettings.NotificationConfig updateNotificationSettings(String userId, UserSettings.NotificationConfig config) {
        var settings = getSettings(userId);
        settings.setNotification(config);
        repository.save(settings);
        return config;
    }

    /**
     * Ensures notification email is set from Keycloak when empty.
     * Called when user makes authenticated requests so email-forward matching works
     * without requiring explicit notification settings.
     */
    public void ensureNotificationEmailFromKeycloak(String userId, String keycloakEmail) {
        if (keycloakEmail == null || keycloakEmail.isBlank()) return;

        var settings = getSettings(userId);
        var notif = settings.getNotification();
        if (notif == null) {
            settings.setNotification(new UserSettings.NotificationConfig());
            notif = settings.getNotification();
        }
        var currentEmail = notif.getEmail();
        if (currentEmail == null || currentEmail.isBlank()) {
            notif.setEmail(keycloakEmail.trim().toLowerCase());
            repository.save(settings);
        }
    }
}
