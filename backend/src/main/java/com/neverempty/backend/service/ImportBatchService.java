package com.neverempty.backend.service;

import com.neverempty.backend.dto.ImportBatchResponse;
import com.neverempty.backend.model.ImportBatch;
import com.neverempty.backend.repository.ImportBatchRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ImportBatchService {

    private final ImportBatchRepository repository;

    public List<ImportBatchResponse> listByUserId(String userId) {
        return repository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(ImportBatchResponse::from)
                .collect(Collectors.toList());
    }

    public Optional<ImportBatchResponse> getByIdAndUserId(String id, String userId) {
        return repository.findByIdAndUserId(id, userId)
                .map(ImportBatchResponse::from);
    }

    public boolean deleteByIdAndUserId(String id, String userId) {
        var existing = repository.findByIdAndUserId(id, userId);
        if (existing.isPresent()) {
            repository.deleteByIdAndUserId(id, userId);
            return true;
        }
        return false;
    }
}
