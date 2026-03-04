package com.neverempty.backend.dto;

import com.neverempty.backend.model.Item;

import java.util.List;

public record ImportReceiptResponse(
        List<Item> importedItems,
        List<String> unrecognizedLines
) {}
