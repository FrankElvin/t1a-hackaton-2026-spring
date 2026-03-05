package com.neverempty.backend.controller;

import com.neverempty.backend.dto.ImportBatchResponse;
import com.neverempty.backend.service.ImportBatchService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/import-batches")
@RequiredArgsConstructor
public class ImportBatchController {

    private final ImportBatchService importBatchService;

    @GetMapping
    public ResponseEntity<List<ImportBatchResponse>> listBatches(@AuthenticationPrincipal Jwt jwt) {
        var userId = jwt.getSubject();
        var batches = importBatchService.listByUserId(userId);
        return ResponseEntity.ok(batches);
    }

    @GetMapping("/{id}")
    public ResponseEntity<ImportBatchResponse> getBatch(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String id) {
        var userId = jwt.getSubject();
        return importBatchService.getByIdAndUserId(id, userId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteBatch(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String id) {
        var userId = jwt.getSubject();
        if (importBatchService.deleteByIdAndUserId(id, userId)) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }
}
