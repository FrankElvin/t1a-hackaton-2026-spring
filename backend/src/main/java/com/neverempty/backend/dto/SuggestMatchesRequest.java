package com.neverempty.backend.dto;

import jakarta.validation.constraints.NotBlank;

public record SuggestMatchesRequest(
        @NotBlank String productName
) {}
