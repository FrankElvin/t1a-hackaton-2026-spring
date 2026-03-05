package com.neverempty.backend.model;

import com.neverempty.backend.dto.ParsedProductDto;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "import_batch")
public class ImportBatch {

    @Id
    private String id;

    @Field("user_id")
    private String userId;

    private Source source;

    @Field("source_metadata")
    private String sourceMetadata;

    @Field("store_id")
    private String storeId;

    @Field("parsed_products")
    private List<ParsedProductDto> parsedProducts;

    @Field("unrecognized_lines")
    private List<String> unrecognizedLines;

    @Field("created_at")
    private Instant createdAt;

    public enum Source {
        RECEIPT,
        EMAIL
    }
}
