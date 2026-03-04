package com.neverempty.backend.model;

import com.neverempty.backend.model.enums.ConsumerCategory;
import com.neverempty.backend.model.enums.ItemCategory;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "item")
public class Item {

    @Id
    private String id;

    @Field("user_id")
    private String userId;

    private String name;

    private ItemCategory category;

    private double currentQuantity;

    private String unit;

    private String storeId;

    private Double price;

    private ConsumerCategory consumerCategory;

    private Double monthlyConsumptionRate;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
