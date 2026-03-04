package com.neverempty.backend.controller;

import com.neverempty.backend.dto.ShoppingList;
import com.neverempty.backend.dto.ShoppingListsResponse;
import com.neverempty.backend.service.SettingsService;
import com.neverempty.backend.service.ShoppingListService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class ShoppingListController {

    private final ShoppingListService shoppingListService;
    private final SettingsService settingsService;

    @GetMapping("/shopping-lists")
    public ResponseEntity<ShoppingListsResponse> getShoppingLists(@AuthenticationPrincipal Jwt jwt) {
        var userId = jwt.getSubject();
        var calculationDate = settingsService.getCalculationDate(userId);
        return ResponseEntity.ok(shoppingListService.getShoppingLists(userId, calculationDate));
    }

    @GetMapping("/shopping-lists/{storeId}")
    public ResponseEntity<ShoppingList> getShoppingListByStore(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String storeId) {
        var userId = jwt.getSubject();
        var calculationDate = settingsService.getCalculationDate(userId);
        return shoppingListService.getShoppingListByStore(userId, storeId, calculationDate)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
