package com.neverempty.backend.repository;

import com.neverempty.backend.model.Product;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface ProductRepository extends MongoRepository<Product, String> {

    Page<Product> findByOwner(String owner, Pageable pageable);

    Optional<Product> findByIdAndOwner(String id, String owner);

    void deleteByIdAndOwner(String id, String owner);

    @Query("{ 'owner': ?0, 'run_out_at.deadline': { $gte: ?1, $lte: ?2 } }")
    Page<Product> findRunningOut(String owner, LocalDate from, LocalDate to, Pageable pageable);

    @Query("{ 'owner': ?0, $or: [ { 'run_out_at': null }, { 'run_out_at.deadline': null } ] }")
    List<Product> findNeedingCalculation(String owner);

    @Query("{ 'owner': ?0, 'name': { $regex: ?1, $options: 'i' } }")
    Page<Product> findByOwnerAndNameMatching(String owner, String nameRegex, Pageable pageable);

    @Query("{ 'owner': ?0, 'category': ?1 }")
    Page<Product> findByOwnerAndCategory(String owner, String category, Pageable pageable);
}
