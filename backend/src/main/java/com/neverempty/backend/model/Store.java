package com.neverempty.backend.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "store")
public class Store {

    @Id
    private String id;

    @Field("user_id")
    private String userId;

    private String name;

    private Integer visitIntervalDays;

    private LocalDate lastVisitDate;
}
