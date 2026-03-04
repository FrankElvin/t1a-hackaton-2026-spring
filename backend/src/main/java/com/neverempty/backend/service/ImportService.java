package com.neverempty.backend.service;

import com.neverempty.backend.dto.ImportReceiptResponse;
import com.neverempty.backend.model.Item;
import com.neverempty.backend.repository.ItemRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import com.neverempty.backend.model.enums.ItemCategory;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

@Slf4j
@Service
@RequiredArgsConstructor
public class ImportService {

    private final OcrService ocrService;
    private final LlmService llmService;
    private final ItemRepository itemRepository;

    public ImportReceiptResponse importFromReceipt(String userId, byte[] image, String storeId) {
        return importFromReceipt(userId, image, storeId, msg -> {});
    }

    public ImportReceiptResponse importFromReceipt(String userId, byte[] image, String storeId, Consumer<String> onProgress) {
        onProgress.accept("Extracting text from receipt via OCR...");
        var ocrText = ocrService.extractText(image);
        onProgress.accept("OCR complete. Sending to AI for parsing...");
        var parsedProducts = llmService.parseReceipt(ocrText);
        onProgress.accept("AI identified " + parsedProducts.size() + " products");

        return processProducts(userId, parsedProducts, storeId, onProgress);
    }

    public ImportReceiptResponse importFromEmail(String userId, String rawEmail) {
        return importFromEmail(userId, rawEmail, msg -> {});
    }

    public ImportReceiptResponse importFromEmail(String userId, String rawEmail, Consumer<String> onProgress) {
        onProgress.accept("Sending email content to AI for parsing...");
        var parsedProducts = llmService.parseEmail(rawEmail);
        onProgress.accept("AI identified " + parsedProducts.size() + " products");

        return processProducts(userId, parsedProducts, null, onProgress);
    }

    private ImportReceiptResponse processProducts(String userId, List<LlmService.ParsedProduct> parsedProducts,
                                                   String storeId, Consumer<String> onProgress) {
        var importedItems = new ArrayList<Item>();
        var unrecognizedLines = new ArrayList<String>();
        int total = parsedProducts.size();

        for (int i = 0; i < total; i++) {
            var parsed = parsedProducts.get(i);
            int idx = i + 1;
            try {
                onProgress.accept("[" + idx + "/" + total + "] Classifying: " + parsed.name());
                var item = enrichAndBuildItem(userId, parsed, storeId, onProgress, idx, total);
                var saved = itemRepository.save(item);
                importedItems.add(saved);
                onProgress.accept("[" + idx + "/" + total + "] Saved: " + saved.getName());
            } catch (Exception e) {
                log.warn("Failed to import parsed product: {}", parsed.name(), e);
                onProgress.accept("[" + idx + "/" + total + "] Failed: " + parsed.name());
                unrecognizedLines.add(parsed.name());
            }
        }

        onProgress.accept("Import complete: " + importedItems.size() + " items saved");
        return new ImportReceiptResponse(importedItems, unrecognizedLines);
    }

    /**
     * Enrich a parsed product with LLM-derived category and consumption rate.
     */
    private Item enrichAndBuildItem(String userId, LlmService.ParsedProduct parsed, String storeId,
                                     Consumer<String> onProgress, int idx, int total) {
        String prefix = "[" + idx + "/" + total + "] ";

        // Classify category via LLM
        ItemCategory category = null;
        String categoryStr = null;
        try {
            categoryStr = llmService.classifyCategory(parsed.name());
            category = mapCategory(categoryStr);
            onProgress.accept(prefix + "Category: " + categoryStr);
        } catch (Exception e) {
            log.warn("Failed to classify category for '{}': {}", parsed.name(), e.getMessage());
        }

        // Estimate runout days via LLM, then convert to monthly consumption rate
        Double monthlyConsumptionRate = null;
        try {
            onProgress.accept(prefix + "Estimating consumption rate...");
            int runoutDays = llmService.estimateRunoutDays(
                    parsed.name(),
                    parsed.quantity(),
                    categoryStr != null ? categoryStr : "other",
                    List.of("adult"),
                    LocalDate.now()
            );
            if (runoutDays > 0) {
                monthlyConsumptionRate = parsed.quantity() * 30.0 / runoutDays;
                onProgress.accept(prefix + "Estimated ~" + runoutDays + " days until depletion");
            }
        } catch (Exception e) {
            log.warn("Failed to estimate runout for '{}': {}", parsed.name(), e.getMessage());
        }

        return Item.builder()
                .userId(userId)
                .name(parsed.name())
                .currentQuantity(parsed.quantity())
                .unit("pcs")
                .storeId(storeId)
                .price(parsed.priceAmount())
                .category(category)
                .monthlyConsumptionRate(monthlyConsumptionRate)
                .build();
    }

    private static ItemCategory mapCategory(String categoryStr) {
        if (categoryStr == null) return null;
        return switch (categoryStr.toLowerCase().trim()) {
            case "grocery", "food" -> ItemCategory.FOOD;
            case "household", "cleaning" -> ItemCategory.CLEANING;
            case "pharmacy", "medicine" -> ItemCategory.MEDICINE;
            case "pet" -> ItemCategory.PET_FOOD;
            case "baby", "personal_care", "personal care" -> ItemCategory.PERSONAL_CARE;
            case "beverages" -> ItemCategory.BEVERAGES;
            default -> ItemCategory.OTHER;
        };
    }
}
