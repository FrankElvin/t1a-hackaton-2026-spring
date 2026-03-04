package com.neverempty.backend.repository;

import com.neverempty.backend.model.Item;
import com.neverempty.backend.model.enums.ItemCategory;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface ItemRepository extends MongoRepository<Item, String> {

    List<Item> findByUserId(String userId);

    Optional<Item> findByIdAndUserId(String id, String userId);

    void deleteByIdAndUserId(String id, String userId);

    List<Item> findByUserIdAndCategory(String userId, ItemCategory category);

    List<Item> findByUserIdAndStoreId(String userId, String storeId);
}
