package com.neverempty.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record EstimateDaysToRestockRequest(
        @NotBlank String name,
        @NotNull Double quantity,
        @NotBlank String unit,
        String category,
        String consumerCategory,
        String lastBoughtDate
) {}
