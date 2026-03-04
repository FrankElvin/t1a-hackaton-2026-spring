package com.neverempty.backend.controller;

import com.neverempty.backend.dto.ImportEmailRequest;
import com.neverempty.backend.dto.ImportReceiptResponse;
import com.neverempty.backend.service.ImportService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class ImportController {

    private final ImportService importService;

    @PostMapping("/items/import/receipt")
    public ResponseEntity<ImportReceiptResponse> importReceipt(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam("image") MultipartFile image,
            @RequestParam(value = "storeId", required = false) String storeId) throws IOException {
        var userId = jwt.getSubject();
        var result = importService.importFromReceipt(userId, image.getBytes(), storeId);
        return ResponseEntity.status(201).body(result);
    }

    @PostMapping("/items/import/email")
    public ResponseEntity<ImportReceiptResponse> importEmail(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody ImportEmailRequest request) {
        var userId = jwt.getSubject();
        var result = importService.importFromEmail(userId, request.rawEmail());
        return ResponseEntity.status(201).body(result);
    }
}
