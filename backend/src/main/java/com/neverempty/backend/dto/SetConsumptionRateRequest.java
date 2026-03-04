package com.neverempty.backend.dto;

import jakarta.validation.constraints.NotNull;

public record SetConsumptionRateRequest(
        @NotNull Double monthlyRate
) {}
