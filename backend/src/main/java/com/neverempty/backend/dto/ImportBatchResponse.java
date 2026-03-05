package com.neverempty.backend.dto;

import com.neverempty.backend.model.ImportBatch;

import java.util.List;

public record ImportBatchResponse(
        String id,
        ImportBatch.Source source,
        String sourceMetadata,
        String storeId,
        List<ParsedProductDto> parsedProducts,
        List<String> unrecognizedLines,
        String createdAt
) {
    public static ImportBatchResponse from(ImportBatch batch) {
        return new ImportBatchResponse(
                batch.getId(),
                batch.getSource(),
                batch.getSourceMetadata(),
                batch.getStoreId(),
                batch.getParsedProducts(),
                batch.getUnrecognizedLines() != null ? batch.getUnrecognizedLines() : List.of(),
                batch.getCreatedAt() != null ? batch.getCreatedAt().toString() : null
        );
    }
}
