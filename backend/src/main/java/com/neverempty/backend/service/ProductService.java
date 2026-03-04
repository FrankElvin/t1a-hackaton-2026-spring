package com.neverempty.backend.service;

import com.neverempty.backend.model.Product;
import com.neverempty.backend.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.BulkOperations;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.data.util.Pair;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ProductService {

    private final ProductRepository repository;
    private final MongoTemplate mongoTemplate;

    public Product create(String owner, Product product) {
        product.setOwner(owner);
        if (product.getLastBought() == null) {
            product.setLastBought(LocalDate.now());
        }
        if (product.getNotification() == null) {
            product.setNotification(new Product.Notification());
        }
        return repository.save(product);
    }

    public Optional<Product> getById(String id) {
        return repository.findById(id);
    }

    public Optional<Product> update(String id, String owner, Product updates) {
        return repository.findByIdAndOwner(id, owner).map(existing -> {
            if (updates.getName() != null) existing.setName(updates.getName());
            if (updates.getQuantity() > 0) existing.setQuantity(updates.getQuantity());
            if (updates.getCategory() != null) existing.setCategory(updates.getCategory());
            if (updates.getShop() != null) existing.setShop(updates.getShop());
            if (updates.getLastBought() != null) existing.setLastBought(updates.getLastBought());
            if (updates.getPrice() != null) existing.setPrice(updates.getPrice());
            if (updates.getConsumers() != null) existing.setConsumers(updates.getConsumers());
            if (updates.getRunOutAt() != null) existing.setRunOutAt(updates.getRunOutAt());
            if (updates.getNotification() != null) existing.setNotification(updates.getNotification());
            return repository.save(existing);
        });
    }

    public boolean delete(String id, String owner) {
        var product = repository.findByIdAndOwner(id, owner);
        product.ifPresent(repository::delete);
        return product.isPresent();
    }

    public Page<Product> listProducts(String owner, int page, int size, String sortOrder,
                                       String category, String search) {
        var direction = "desc".equalsIgnoreCase(sortOrder) ? Sort.Direction.DESC : Sort.Direction.ASC;
        var pageable = PageRequest.of(page, size, Sort.by(direction, "runOutAt.deadline"));

        if (search != null && !search.isBlank()) {
            return repository.findByOwnerAndNameMatching(owner, search, pageable);
        }
        if (category != null && !category.isBlank()) {
            return repository.findByOwnerAndCategory(owner, category, pageable);
        }
        return repository.findByOwner(owner, pageable);
    }

    /**
     * Quick "mark as bought" action:
     * - Set lastBought = today
     * - Clear run-out deadline (to be recalculated)
     * - Reset notification flags
     */
    public Optional<Product> markAsBought(String id, String owner) {
        return repository.findByIdAndOwner(id, owner).map(product -> {
            product.setLastBought(LocalDate.now());
            product.setRunOutAt(new Product.RunOutAt(null, "calculated"));
            product.setNotification(new Product.Notification(false, false));
            return repository.save(product);
        });
    }

    public Page<Product> listRunningOut(String owner, LocalDate referenceDate, int daysRange,
                                         int page, int size) {
        var to = referenceDate.plusDays(daysRange);
        var pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.ASC, "runOutAt.deadline"));
        return repository.findRunningOut(owner, referenceDate, to, pageable);
    }

    public List<Product> getProductsNeedingCalculation(String owner) {
        return repository.findNeedingCalculation(owner);
    }

    /**
     * Batch update run-out deadlines for multiple products.
     * Returns count of updated documents.
     */
    public int bulkUpdateRunout(List<Pair<String, LocalDate>> updates) {
        if (updates.isEmpty()) return 0;

        var bulkOps = mongoTemplate.bulkOps(BulkOperations.BulkMode.UNORDERED, Product.class);
        for (var entry : updates) {
            var query = new Query(Criteria.where("_id").is(entry.getFirst()));
            var update = new Update()
                    .set("run_out_at.deadline", entry.getSecond())
                    .set("run_out_at.type", "calculated");
            bulkOps.updateOne(query, update);
        }
        return bulkOps.execute().getModifiedCount();
    }
}
