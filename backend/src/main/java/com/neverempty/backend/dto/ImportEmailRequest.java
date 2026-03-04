package com.neverempty.backend.dto;

import jakarta.validation.constraints.NotBlank;

public record ImportEmailRequest(
        @NotBlank String rawEmail
) {}
