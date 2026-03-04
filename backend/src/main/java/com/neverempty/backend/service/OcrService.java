package com.neverempty.backend.service;

import com.google.cloud.vision.v1.AnnotateImageRequest;
import com.google.cloud.vision.v1.Feature;
import com.google.cloud.vision.v1.Image;
import com.google.cloud.vision.v1.ImageAnnotatorClient;
import com.google.cloud.vision.v1.ImageAnnotatorSettings;
import com.google.protobuf.ByteString;
import com.google.auth.oauth2.ServiceAccountCredentials;
import com.neverempty.backend.config.AppProperties;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.FileInputStream;
import java.io.IOException;
import java.util.List;

/**
 * Google Cloud Vision text extraction.
 * Adapts the algorithm from TestInvoiceParser/ocr_service.py:
 * - Image bytes → Cloud Vision textDetection → fullTextAnnotation.text
 */
@Slf4j
@Service
public class OcrService {

    private final AppProperties properties;
    private ImageAnnotatorClient client;

    public OcrService(AppProperties properties) {
        this.properties = properties;
    }

    @PostConstruct
    public void init() throws IOException {
        var credentialsPath = properties.google().credentialsPath();
        if (credentialsPath == null || credentialsPath.isBlank()) {
            log.warn("Google credentials path not configured, OCR service disabled");
            return;
        }

        var credentials = ServiceAccountCredentials.fromStream(new FileInputStream(credentialsPath));
        var settings = ImageAnnotatorSettings.newBuilder()
                .setCredentialsProvider(() -> credentials)
                .build();
        this.client = ImageAnnotatorClient.create(settings);
    }

    @PreDestroy
    public void shutdown() {
        if (client != null) {
            client.close();
        }
    }

    /**
     * Extract text from image bytes using Cloud Vision text_detection.
     * Same algorithm as ocr_service.py extract_text().
     */
    public String extractText(byte[] imageBytes) {
        if (client == null) {
            throw new IllegalStateException("OCR service not initialized: credentials not configured");
        }

        var image = Image.newBuilder()
                .setContent(ByteString.copyFrom(imageBytes))
                .build();

        var feature = Feature.newBuilder()
                .setType(Feature.Type.TEXT_DETECTION)
                .build();

        var request = AnnotateImageRequest.newBuilder()
                .addFeatures(feature)
                .setImage(image)
                .build();

        var responses = client.batchAnnotateImages(List.of(request));
        var response = responses.getResponsesList().get(0);

        if (response.hasError()) {
            throw new RuntimeException("Vision API error: " + response.getError().getMessage());
        }

        var annotation = response.getFullTextAnnotation();
        return annotation != null ? annotation.getText() : "";
    }
}
