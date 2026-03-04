package com.neverempty.backend.controller;

import com.neverempty.backend.config.AppProperties;
import com.neverempty.backend.service.SettingsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.Map;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class SettingsController {

    private final SettingsService settingsService;
    private final AppProperties appProperties;

    @GetMapping("/settings/forward-email")
    public ResponseEntity<Map<String, String>> getForwardEmail() {
        var email = appProperties.google() != null && appProperties.google().gmailImpersonateEmail() != null
                ? appProperties.google().gmailImpersonateEmail()
                : "inbox@neverempty.app";
        return ResponseEntity.ok(Map.of("forwardEmail", email));
    }

    @GetMapping("/settings/calculation-date")
    public ResponseEntity<Map<String, LocalDate>> getCalculationDate(@AuthenticationPrincipal Jwt jwt) {
        var userId = jwt.getSubject();
        var date = settingsService.getCalculationDate(userId);
        return ResponseEntity.ok(Map.of("calculationDate", date));
    }

    @PutMapping("/settings/calculation-date")
    public ResponseEntity<Map<String, LocalDate>> setCalculationDate(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody Map<String, LocalDate> body) {
        var userId = jwt.getSubject();
        var date = body.get("calculationDate");
        settingsService.setCalculationDate(userId, date);
        return ResponseEntity.ok(Map.of("calculationDate", date));
    }
}
