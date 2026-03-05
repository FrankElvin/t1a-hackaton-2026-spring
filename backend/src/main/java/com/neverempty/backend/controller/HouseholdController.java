package com.neverempty.backend.controller;

import com.neverempty.backend.model.Household;
import com.neverempty.backend.service.HouseholdService;
import com.neverempty.backend.service.SettingsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class HouseholdController {

    private final HouseholdService householdService;
    private final SettingsService settingsService;

    @GetMapping("/household")
    public ResponseEntity<Household> getHousehold(@AuthenticationPrincipal Jwt jwt) {
        var userId = jwt.getSubject();
        settingsService.ensureNotificationEmailFromKeycloak(userId, jwt.getClaimAsString("email"));
        return householdService.getByUserId(userId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/household")
    public ResponseEntity<Household> upsertHousehold(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody Household household) {
        var userId = jwt.getSubject();
        var saved = householdService.upsert(userId, household);
        return ResponseEntity.ok(saved);
    }

    @PostMapping("/household/members")
    public ResponseEntity<Household.Member> addMember(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody Household.Member member) {
        var userId = jwt.getSubject();
        var created = householdService.addMember(userId, member);
        return ResponseEntity.status(201).body(created);
    }

    @DeleteMapping("/household/members/{memberId}")
    public ResponseEntity<Void> removeMember(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String memberId) {
        var userId = jwt.getSubject();
        if (householdService.removeMember(userId, memberId)) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }

    @PostMapping("/household/pets")
    public ResponseEntity<Household.Pet> addPet(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody Household.Pet pet) {
        var userId = jwt.getSubject();
        var created = householdService.addPet(userId, pet);
        return ResponseEntity.status(201).body(created);
    }

    @DeleteMapping("/household/pets/{petId}")
    public ResponseEntity<Void> removePet(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String petId) {
        var userId = jwt.getSubject();
        if (householdService.removePet(userId, petId)) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }
}
