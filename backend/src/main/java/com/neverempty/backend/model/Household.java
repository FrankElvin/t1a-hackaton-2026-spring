package com.neverempty.backend.model;

import com.neverempty.backend.model.enums.PersonCategory;
import com.neverempty.backend.model.enums.PetCategory;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "household")
public class Household {

    @Id
    private String id;

    @Field("user_id")
    private String userId;

    @Builder.Default
    private List<Member> members = new ArrayList<>();

    @Builder.Default
    private List<Pet> pets = new ArrayList<>();

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class Member {
        @Builder.Default
        private String id = UUID.randomUUID().toString();
        private String name;
        private PersonCategory category;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class Pet {
        @Builder.Default
        private String id = UUID.randomUUID().toString();
        private String name;
        private PetCategory category;
    }
}
