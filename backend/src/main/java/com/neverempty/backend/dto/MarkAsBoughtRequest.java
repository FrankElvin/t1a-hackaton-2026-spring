package com.neverempty.backend.dto;

import java.time.LocalDate;

/**
 * Optional body for POST /items/{id}/mark-bought.
 * If boughtDate is null, the caller should pass today / calculationDate.
 */
public record MarkAsBoughtRequest(
        LocalDate boughtDate
) {}
