package com.neverempty.backend.controller;

import com.neverempty.backend.model.Store;
import com.neverempty.backend.service.StoreService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class StoreController {

    private final StoreService storeService;

    @GetMapping("/stores")
    public ResponseEntity<List<Store>> listStores(@AuthenticationPrincipal Jwt jwt) {
        var userId = jwt.getSubject();
        return ResponseEntity.ok(storeService.listStores(userId));
    }

    @PostMapping("/stores")
    public ResponseEntity<Store> createStore(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody Store store) {
        var userId = jwt.getSubject();
        var created = storeService.createStore(userId, store);
        return ResponseEntity.status(201).body(created);
    }

    @GetMapping("/stores/{storeId}")
    public ResponseEntity<Store> getStore(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String storeId) {
        var userId = jwt.getSubject();
        return storeService.getStore(userId, storeId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/stores/{storeId}")
    public ResponseEntity<Store> updateStore(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String storeId,
            @RequestBody Store store) {
        var userId = jwt.getSubject();
        return storeService.updateStore(userId, storeId, store)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/stores/{storeId}")
    public ResponseEntity<Void> deleteStore(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String storeId) {
        var userId = jwt.getSubject();
        if (storeService.deleteStore(userId, storeId)) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }
}
