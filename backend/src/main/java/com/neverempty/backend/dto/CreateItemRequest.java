package com.neverempty.backend.dto;

import com.neverempty.backend.model.enums.ConsumerCategory;
import com.neverempty.backend.model.enums.ItemCategory;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateItemRequest(
        @NotBlank String name,
        ItemCategory category,
        @NotNull Double currentQuantity,
        @NotBlank String unit,
        String storeId,
        Double price,
        ConsumerCategory consumerCategory,
        Double daysToRestock,
        Boolean autoCalc,
        String lastBoughtDate,
        Double standardPurchaseQuantity
) {}
