package com.neverempty.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;

public record TriggerNotificationRequest(
        @NotBlank String userId,
        @NotNull Instant checkDate,
        boolean ignorePrevNotification
) {}
