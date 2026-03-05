package com.neverempty.backend.controller;

import com.neverempty.backend.dto.DashboardSummary;
import com.neverempty.backend.dto.ItemForecast;
import com.neverempty.backend.service.DashboardService;
import com.neverempty.backend.service.SettingsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;
    private final SettingsService settingsService;

    @GetMapping("/dashboard")
    public ResponseEntity<DashboardSummary> getDashboard(@AuthenticationPrincipal Jwt jwt) {
        var userId = jwt.getSubject();
        settingsService.ensureNotificationEmailFromKeycloak(userId, jwt.getClaimAsString("email"));
        return ResponseEntity.ok(dashboardService.getDashboard(userId));
    }

    @GetMapping("/dashboard/stock-levels")
    public ResponseEntity<List<ItemForecast>> getStockLevels(@AuthenticationPrincipal Jwt jwt) {
        var userId = jwt.getSubject();
        return ResponseEntity.ok(dashboardService.getStockLevels(userId));
    }

    @GetMapping("/dashboard/upcoming-purchases")
    public ResponseEntity<List<ItemForecast>> getUpcomingPurchases(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "30") int withinDays) {
        var userId = jwt.getSubject();
        return ResponseEntity.ok(dashboardService.getUpcomingPurchases(userId, withinDays));
    }
}
