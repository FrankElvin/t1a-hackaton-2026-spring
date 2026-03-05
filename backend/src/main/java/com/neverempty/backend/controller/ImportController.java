package com.neverempty.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.neverempty.backend.dto.ImportBatchResponse;
import com.neverempty.backend.dto.ImportEmailRequest;
import com.neverempty.backend.dto.ImportReceiptResponse;
import com.neverempty.backend.service.ImportService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Slf4j
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class ImportController {

    private final ImportService importService;
    private final ObjectMapper objectMapper;

    private final ExecutorService executor = Executors.newCachedThreadPool();

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

    @PostMapping(value = "/items/import/receipt/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter importReceiptStream(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam("image") MultipartFile image,
            @RequestParam(value = "storeId", required = false) String storeId) throws IOException {
        var userId = jwt.getSubject();
        var imageBytes = image.getBytes();
        var emitter = new SseEmitter(180_000L);

        executor.execute(() -> {
            try {
                var result = importService.importFromReceipt(userId, imageBytes, storeId, msg -> {
                    try {
                        emitter.send(SseEmitter.event().name("progress").data(msg));
                    } catch (IOException ignored) {}
                });
                emitter.send(SseEmitter.event().name("result").data(objectMapper.writeValueAsString(result)));
                emitter.complete();
            } catch (Exception e) {
                log.error("Streaming receipt import failed", e);
                try {
                    emitter.send(SseEmitter.event().name("error").data(e.getMessage()));
                } catch (IOException ignored) {}
                emitter.complete();
            }
        });

        return emitter;
    }

    @PostMapping(value = "/items/import/email/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter importEmailStream(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody ImportEmailRequest request) {
        var userId = jwt.getSubject();
        var emitter = new SseEmitter(180_000L);

        executor.execute(() -> {
            try {
                var result = importService.importFromEmail(userId, request.rawEmail(), msg -> {
                    try {
                        emitter.send(SseEmitter.event().name("progress").data(msg));
                    } catch (IOException ignored) {}
                });
                emitter.send(SseEmitter.event().name("result").data(objectMapper.writeValueAsString(result)));
                emitter.complete();
            } catch (Exception e) {
                log.error("Streaming email import failed", e);
                try {
                    emitter.send(SseEmitter.event().name("error").data(e.getMessage()));
                } catch (IOException ignored) {}
                emitter.complete();
            }
        });

        return emitter;
    }

    /**
     * Parse receipt only - creates ImportBatch for user to review products one-by-one.
     */
    @PostMapping(value = "/items/import/receipt/parse/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter parseReceiptStream(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam("image") MultipartFile image,
            @RequestParam(value = "storeId", required = false) String storeId) throws IOException {
        var userId = jwt.getSubject();
        var imageBytes = image.getBytes();
        var emitter = new SseEmitter(180_000L);

        executor.execute(() -> {
            try {
                var batch = importService.parseOnlyFromReceipt(userId, imageBytes, storeId, msg -> {
                    try {
                        emitter.send(SseEmitter.event().name("progress").data(msg));
                    } catch (IOException ignored) {}
                });
                var response = ImportBatchResponse.from(batch);
                emitter.send(SseEmitter.event().name("result").data(objectMapper.writeValueAsString(response)));
                emitter.complete();
            } catch (Exception e) {
                log.error("Parse receipt stream failed", e);
                try {
                    emitter.send(SseEmitter.event().name("error").data(e.getMessage()));
                } catch (IOException ignored) {}
                emitter.complete();
            }
        });

        return emitter;
    }

    /**
     * Parse email only - creates ImportBatch for user to review products one-by-one.
     */
    @PostMapping(value = "/items/import/email/parse/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter parseEmailStream(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody ImportEmailRequest request) {
        var userId = jwt.getSubject();
        var emitter = new SseEmitter(180_000L);

        executor.execute(() -> {
            try {
                var batch = importService.parseOnlyFromEmail(userId, request.rawEmail(), msg -> {
                    try {
                        emitter.send(SseEmitter.event().name("progress").data(msg));
                    } catch (IOException ignored) {}
                });
                var response = ImportBatchResponse.from(batch);
                emitter.send(SseEmitter.event().name("result").data(objectMapper.writeValueAsString(response)));
                emitter.complete();
            } catch (Exception e) {
                log.error("Parse email stream failed", e);
                try {
                    emitter.send(SseEmitter.event().name("error").data(e.getMessage()));
                } catch (IOException ignored) {}
                emitter.complete();
            }
        });

        return emitter;
    }
}
