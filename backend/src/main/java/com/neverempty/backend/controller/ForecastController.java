package com.neverempty.backend.controller;

import com.neverempty.backend.dto.ForecastResponse;
import com.neverempty.backend.dto.ItemForecast;
import com.neverempty.backend.service.ForecastService;
import com.neverempty.backend.service.SettingsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class ForecastController {

    private final ForecastService forecastService;
    private final SettingsService settingsService;

    @GetMapping("/forecast")
    public ResponseEntity<ForecastResponse> getForecast(@AuthenticationPrincipal Jwt jwt) {
        var userId = jwt.getSubject();
        var calculationDate = settingsService.getCalculationDate(userId);
        return ResponseEntity.ok(forecastService.getForecast(userId, calculationDate));
    }

    @GetMapping("/forecast/{itemId}")
    public ResponseEntity<ItemForecast> getItemForecast(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String itemId) {
        var userId = jwt.getSubject();
        var calculationDate = settingsService.getCalculationDate(userId);
        return forecastService.getItemForecast(userId, itemId, calculationDate)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
