package com.neverempty.backend.dto;

import java.time.LocalDate;

public record MarkConsumedRequest(
        LocalDate depletedAt
) {}
