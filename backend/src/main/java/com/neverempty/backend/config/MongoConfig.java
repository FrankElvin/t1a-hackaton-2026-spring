package com.neverempty.backend.config;

import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.event.EventListener;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.config.EnableMongoAuditing;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.CompoundIndexDefinition;
import org.springframework.data.mongodb.core.index.Index;
import org.bson.Document;

@Configuration
@EnableMongoAuditing
public class MongoConfig {

    private final MongoTemplate mongoTemplate;

    public MongoConfig(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void ensureIndexes() {
        // household: unique index on user_id
        mongoTemplate.indexOps("household").ensureIndex(
                new Index().on("user_id", Sort.Direction.ASC).unique()
        );

        // household: compound index for batch processing
        mongoTemplate.indexOps("household").ensureIndex(
                new CompoundIndexDefinition(new Document()
                        .append("active", 1)
                        .append("lock.locked", 1)
                        .append("lock.until", 1))
        );

        // item: compound index on user_id + category
        mongoTemplate.indexOps("item").ensureIndex(
                new CompoundIndexDefinition(new Document()
                        .append("user_id", 1)
                        .append("category", 1))
        );

        // item: compound index on user_id + storeId
        mongoTemplate.indexOps("item").ensureIndex(
                new CompoundIndexDefinition(new Document()
                        .append("user_id", 1)
                        .append("storeId", 1))
        );

        // store: index on user_id
        mongoTemplate.indexOps("store").ensureIndex(
                new Index().on("user_id", Sort.Direction.ASC)
        );

        // user_settings: unique index on user_id
        mongoTemplate.indexOps("user_settings").ensureIndex(
                new Index().on("user_id", Sort.Direction.ASC).unique()
        );

        // import_batch: index on user_id for listing
        mongoTemplate.indexOps("import_batch").ensureIndex(
                new Index().on("user_id", Sort.Direction.ASC)
        );

        // product: compound index on owner + run_out_at.deadline (legacy)
        mongoTemplate.indexOps("product").ensureIndex(
                new CompoundIndexDefinition(new Document()
                        .append("owner", 1)
                        .append("run_out_at.deadline", 1))
        );
    }
}
