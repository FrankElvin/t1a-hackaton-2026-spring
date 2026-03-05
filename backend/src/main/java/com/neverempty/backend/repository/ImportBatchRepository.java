package com.neverempty.backend.repository;

import com.neverempty.backend.model.ImportBatch;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface ImportBatchRepository extends MongoRepository<ImportBatch, String> {

    List<ImportBatch> findByUserIdOrderByCreatedAtDesc(String userId);

    java.util.Optional<ImportBatch> findByIdAndUserId(String id, String userId);

    void deleteByIdAndUserId(String id, String userId);
}
