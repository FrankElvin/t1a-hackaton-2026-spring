package com.neverempty.backend.dto;

import jakarta.validation.constraints.NotNull;

public record AddQuantityRequest(
        @NotNull Double quantity
) {}
