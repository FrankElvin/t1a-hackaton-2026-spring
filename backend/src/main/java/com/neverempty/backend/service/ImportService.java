package com.neverempty.backend.service;

import com.neverempty.backend.dto.ImportReceiptResponse;
import com.neverempty.backend.model.Item;
import com.neverempty.backend.repository.ItemRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import com.neverempty.backend.model.enums.ItemCategory;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import java.util.stream.Collectors;

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

        // ── Step 1: Batch classify all products in a single LLM call ──
        onProgress.accept("Classifying all " + total + " products...");
        Map<String, LlmService.ClassifiedProduct> classifiedMap = Map.of();
        try {
            var classified = llmService.classifyAll(parsedProducts);
            classifiedMap = classified.stream()
                    .collect(Collectors.toMap(LlmService.ClassifiedProduct::name, c -> c, (a, b) -> a));
            onProgress.accept("Classification complete for " + classified.size() + " products");
        } catch (Exception e) {
            log.warn("Batch classification failed, products will be saved without category/runout", e);
            onProgress.accept("Classification failed, saving products without enrichment");
        }

        // ── Step 2: Build all items using classification results ──
        var itemsToSave = new ArrayList<Item>();
        for (int i = 0; i < total; i++) {
            var parsed = parsedProducts.get(i);
            int idx = i + 1;
            try {
                var cl = classifiedMap.get(parsed.name());

                ItemCategory category = null;
                Double daysToRestock = null;
                Double usagePerDay = null;

                if (cl != null) {
                    category = mapCategory(cl.category());
                    if (cl.runoutDays() > 0) {
                        daysToRestock = (double) cl.runoutDays();
                        usagePerDay = parsed.quantity() / cl.runoutDays();
                    }
                    onProgress.accept("[" + idx + "/" + total + "] " + parsed.name()
                            + " → " + cl.category() + ", ~" + cl.runoutDays() + " days");
                } else {
                    onProgress.accept("[" + idx + "/" + total + "] " + parsed.name() + " → not classified");
                }

                String unit = (parsed.unit() != null && !parsed.unit().isBlank())
                        ? parsed.unit() : "pcs";
                itemsToSave.add(Item.builder()
                        .userId(userId)
                        .name(parsed.name())
                        .currentQuantity(parsed.quantity())
                        .unit(unit)
                        .storeId(storeId)
                        .price(parsed.priceAmount())
                        .category(category)
                        .daysToRestock(daysToRestock)
                        .usagePerDay(usagePerDay)
                        .build());
            } catch (Exception e) {
                log.warn("Failed to build item for '{}': {}", parsed.name(), e);
                onProgress.accept("[" + idx + "/" + total + "] Failed: " + parsed.name());
                unrecognizedLines.add(parsed.name());
            }
        }

        // ── Step 3: Save all items at once ──
        onProgress.accept("Saving " + itemsToSave.size() + " items...");
        var saved = itemRepository.saveAll(itemsToSave);
        importedItems.addAll(saved);
        onProgress.accept("Import complete: " + importedItems.size() + " items saved");

        return new ImportReceiptResponse(importedItems, unrecognizedLines);
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
