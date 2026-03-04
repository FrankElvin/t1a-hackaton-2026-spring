package com.neverempty.backend.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "product")
public class Product {

    @Id
    private String id;

    private String owner;

    private String name;

    @Builder.Default
    private double quantity = 1.0;

    private String category;

    private String shop;

    @Field("last_bought")
    private LocalDate lastBought;

    @Builder.Default
    private Price price = new Price();

    @Builder.Default
    private List<String> consumers = new ArrayList<>(List.of("adult"));

    @Field("run_out_at")
    private RunOutAt runOutAt;

    @Builder.Default
    private Notification notification = new Notification();

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Price {
        private String currency = "USD";
        private double amount = 0.0;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RunOutAt {
        private LocalDate deadline;
        private String type = "calculated";
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Notification {
        @Field("run_out_soon")
        private boolean runOutSoon;
        @Field("ran_out")
        private boolean ranOut;
    }
}
