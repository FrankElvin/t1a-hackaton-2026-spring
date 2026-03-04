package com.neverempty.backend.model.enums;

public enum ProductCategory {
    GROCERY,
    HOUSEHOLD,
    PHARMACY,
    PET,
    BABY,
    ELECTRONICS,
    CLOTHING,
    OTHER;

    public static ProductCategory fromString(String value) {
        try {
            return valueOf(value.toUpperCase());
        } catch (IllegalArgumentException e) {
            return OTHER;
        }
    }
}
