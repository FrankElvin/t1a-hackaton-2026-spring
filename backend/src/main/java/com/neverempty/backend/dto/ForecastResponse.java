package com.neverempty.backend.dto;

import java.time.LocalDate;
import java.util.List;

public record ForecastResponse(
        LocalDate calculationDate,
        List<ItemForecast> items
) {}
