package com.neverempty.backend.dto;

public record MatchSuggestion(
        String itemId,
        String name,
        double score
) {}
