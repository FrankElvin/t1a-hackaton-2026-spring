package com.neverempty.backend.dto;

import java.time.LocalDate;
import java.util.List;

public record ShoppingListsResponse(
        LocalDate calculationDate,
        List<ShoppingList> lists
) {}
