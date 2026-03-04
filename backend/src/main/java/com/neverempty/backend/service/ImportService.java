package com.neverempty.backend.service;

import com.neverempty.backend.dto.ImportReceiptResponse;
import com.neverempty.backend.model.Item;
import com.neverempty.backend.repository.ItemRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

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
                var item = Item.builder()
                        .userId(userId)
                        .name(parsed.name())
                        .currentQuantity(parsed.quantity())
                        .unit("pcs")
                        .storeId(storeId)
                        .price(parsed.priceAmount())
                        .build();
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
                var item = Item.builder()
                        .userId(userId)
                        .name(parsed.name())
                        .currentQuantity(parsed.quantity())
                        .unit("pcs")
                        .price(parsed.priceAmount())
                        .build();
                var saved = itemRepository.save(item);
                importedItems.add(saved);
            } catch (Exception e) {
                log.warn("Failed to import parsed product: {}", parsed.name(), e);
                unrecognizedLines.add(parsed.name());
            }
        }

        return new ImportReceiptResponse(importedItems, unrecognizedLines);
    }
}
