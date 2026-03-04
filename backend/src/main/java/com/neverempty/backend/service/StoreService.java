package com.neverempty.backend.service;

import com.neverempty.backend.model.Store;
import com.neverempty.backend.repository.StoreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class StoreService {

    private final StoreRepository repository;

    public List<Store> listStores(String userId) {
        return repository.findByUserId(userId);
    }

    public Optional<Store> getStore(String userId, String storeId) {
        return repository.findByIdAndUserId(storeId, userId);
    }

    public Store createStore(String userId, Store store) {
        store.setUserId(userId);
        store.setId(null);
        return repository.save(store);
    }

    public Optional<Store> updateStore(String userId, String storeId, Store store) {
        return repository.findByIdAndUserId(storeId, userId)
                .map(existing -> {
                    existing.setName(store.getName());
                    existing.setVisitIntervalDays(store.getVisitIntervalDays());
                    existing.setLastVisitDate(store.getLastVisitDate());
                    return repository.save(existing);
                });
    }

    public boolean deleteStore(String userId, String storeId) {
        var existing = repository.findByIdAndUserId(storeId, userId);
        if (existing.isPresent()) {
            repository.deleteByIdAndUserId(storeId, userId);
            return true;
        }
        return false;
    }
}
