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

@Slf4j
@Service
@RequiredArgsConstructor
public class ImportService {

    private final OcrService ocrService;
    private final LlmService llmService;
    private final ItemRepository itemRepository;

    public ImportReceiptResponse importFromReceipt(String userId, byte[] image, String storeId) {
        var ocrText = ocrService.extractText(image);
        var parsedProducts = llmService.parseReceipt(ocrText);

        var importedItems = new ArrayList<Item>();
        var unrecognizedLines = new ArrayList<String>();

        for (var parsed : parsedProducts) {
            try {
                var item = enrichAndBuildItem(userId, parsed, storeId);
                var saved = itemRepository.save(item);
                importedItems.add(saved);
            } catch (Exception e) {
                log.warn("Failed to import parsed product: {}", parsed.name(), e);
                unrecognizedLines.add(parsed.name());
            }
        }

        return new ImportReceiptResponse(importedItems, unrecognizedLines);
    }

    public ImportReceiptResponse importFromEmail(String userId, String rawEmail) {
        var parsedProducts = llmService.parseEmail(rawEmail);

        var importedItems = new ArrayList<Item>();
        var unrecognizedLines = new ArrayList<String>();

        for (var parsed : parsedProducts) {
            try {
                var item = enrichAndBuildItem(userId, parsed, null);
                var saved = itemRepository.save(item);
                importedItems.add(saved);
            } catch (Exception e) {
                log.warn("Failed to import parsed product: {}", parsed.name(), e);
                unrecognizedLines.add(parsed.name());
            }
        }

        return new ImportReceiptResponse(importedItems, unrecognizedLines);
    }

    /**
     * Enrich a parsed product with LLM-derived category and consumption rate.
     */
    private Item enrichAndBuildItem(String userId, LlmService.ParsedProduct parsed, String storeId) {
        // Classify category via LLM
        ItemCategory category = null;
        String categoryStr = null;
        try {
            categoryStr = llmService.classifyCategory(parsed.name());
            category = mapCategory(categoryStr);
        } catch (Exception e) {
            log.warn("Failed to classify category for '{}': {}", parsed.name(), e.getMessage());
        }

        // Estimate runout days via LLM, then convert to monthly consumption rate
        Double monthlyConsumptionRate = null;
        try {
            int runoutDays = llmService.estimateRunoutDays(
                    parsed.name(),
                    parsed.quantity(),
                    categoryStr != null ? categoryStr : "other",
                    List.of("adult"),
                    LocalDate.now()
            );
            if (runoutDays > 0) {
                // monthlyRate = quantity * 30 / runoutDays
                monthlyConsumptionRate = parsed.quantity() * 30.0 / runoutDays;
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
