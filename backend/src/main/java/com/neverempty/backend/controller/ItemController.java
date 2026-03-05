package com.neverempty.backend.controller;

import com.neverempty.backend.dto.CreateItemRequest;
import com.neverempty.backend.dto.MarkAsBoughtRequest;
import com.neverempty.backend.dto.MarkConsumedRequest;
import com.neverempty.backend.model.Item;
import com.neverempty.backend.model.enums.ItemCategory;
import com.neverempty.backend.service.ItemService;
import com.neverempty.backend.service.SettingsService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class ItemController {

    private final ItemService itemService;
    private final SettingsService settingsService;

    @GetMapping("/items")
    public ResponseEntity<List<Item>> listItems(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) ItemCategory category,
            @RequestParam(required = false) String storeId) {
        var userId = jwt.getSubject();
        return ResponseEntity.ok(itemService.listItems(userId, category, storeId));
    }

    @PostMapping("/items")
    public ResponseEntity<Item> createItem(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody CreateItemRequest request) {
        var userId = jwt.getSubject();
        var calcDate = settingsService.getCalculationDate(userId);
        var created = itemService.createItem(userId, request, calcDate);
        return ResponseEntity.status(201).body(created);
    }

    @GetMapping("/items/{itemId}")
    public ResponseEntity<Item> getItem(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String itemId) {
        var userId = jwt.getSubject();
        return itemService.getItem(userId, itemId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/items/{itemId}")
    public ResponseEntity<Item> updateItem(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String itemId,
            @Valid @RequestBody CreateItemRequest request) {
        var userId = jwt.getSubject();
        return itemService.updateItem(userId, itemId, request)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/items/{itemId}")
    public ResponseEntity<Void> deleteItem(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String itemId) {
        var userId = jwt.getSubject();
        if (itemService.deleteItem(userId, itemId)) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }

    @PostMapping("/items/{itemId}/mark-bought")
    public ResponseEntity<Item> markAsBought(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String itemId,
            @RequestBody(required = false) MarkAsBoughtRequest request) {
        var userId = jwt.getSubject();
        // Use provided date, or fall back to user's calculationDate (usually today)
        var boughtDate = (request != null && request.boughtDate() != null)
                ? request.boughtDate()
                : settingsService.getCalculationDate(userId);
        return itemService.markAsBought(userId, itemId, boughtDate)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/items/{itemId}/depleted")
    public ResponseEntity<Item> markDepleted(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String itemId,
            @RequestBody(required = false) MarkConsumedRequest request) {
        var userId = jwt.getSubject();
        var req = request != null ? request : new MarkConsumedRequest(null);
        return itemService.markDepleted(userId, itemId, req)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
