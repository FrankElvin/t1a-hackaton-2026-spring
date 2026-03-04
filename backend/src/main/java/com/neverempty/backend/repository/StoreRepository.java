package com.neverempty.backend.repository;

import com.neverempty.backend.model.Store;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface StoreRepository extends MongoRepository<Store, String> {

    List<Store> findByUserId(String userId);

    Optional<Store> findByIdAndUserId(String id, String userId);

    void deleteByIdAndUserId(String id, String userId);
}
