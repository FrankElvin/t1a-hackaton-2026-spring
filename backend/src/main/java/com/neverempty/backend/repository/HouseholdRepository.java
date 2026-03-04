package com.neverempty.backend.repository;

import com.neverempty.backend.model.Household;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface HouseholdRepository extends MongoRepository<Household, String> {

    Optional<Household> findByUserId(String userId);

    List<Household> findByActiveTrue();
}
