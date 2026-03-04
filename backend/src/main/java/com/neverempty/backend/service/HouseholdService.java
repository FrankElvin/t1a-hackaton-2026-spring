package com.neverempty.backend.service;

import com.neverempty.backend.model.Household;
import com.neverempty.backend.repository.HouseholdRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class HouseholdService {

    private final HouseholdRepository repository;
    private final MongoTemplate mongoTemplate;

    public Optional<Household> getByUserId(String userId) {
        return repository.findByUserId(userId);
    }

    public Household upsert(String userId, Household household) {
        var existing = repository.findByUserId(userId);
        if (existing.isPresent()) {
            var current = existing.get();
            current.setMembers(household.getMembers());
            current.setPets(household.getPets());
            return repository.save(current);
        }
        household.setUserId(userId);
        return repository.save(household);
    }

    public Household.Member addMember(String userId, Household.Member member) {
        var household = repository.findByUserId(userId)
                .orElseGet(() -> {
                    var h = Household.builder().userId(userId).build();
                    return repository.save(h);
                });
        member.setId(UUID.randomUUID().toString());
        household.getMembers().add(member);
        repository.save(household);
        return member;
    }

    public boolean removeMember(String userId, String memberId) {
        return repository.findByUserId(userId)
                .map(household -> {
                    boolean removed = household.getMembers()
                            .removeIf(m -> m.getId().equals(memberId));
                    if (removed) {
                        repository.save(household);
                    }
                    return removed;
                })
                .orElse(false);
    }

    public Household.Pet addPet(String userId, Household.Pet pet) {
        var household = repository.findByUserId(userId)
                .orElseGet(() -> {
                    var h = Household.builder().userId(userId).build();
                    return repository.save(h);
                });
        pet.setId(UUID.randomUUID().toString());
        household.getPets().add(pet);
        repository.save(household);
        return pet;
    }

    public boolean removePet(String userId, String petId) {
        return repository.findByUserId(userId)
                .map(household -> {
                    boolean removed = household.getPets()
                            .removeIf(p -> p.getId().equals(petId));
                    if (removed) {
                        repository.save(household);
                    }
                    return removed;
                })
                .orElse(false);
    }

    // ---- Legacy compatibility methods used by NotificationService and RunoutService ----

    public List<String> getConsumerCategories(String userId) {
        return repository.findByUserId(userId)
                .<List<String>>map(h -> {
                    var categories = new ArrayList<String>();
                    if (h.getMembers() != null) {
                        h.getMembers().forEach(m -> {
                            if (m.getCategory() != null) {
                                categories.add(m.getCategory().name());
                            }
                        });
                    }
                    if (h.getPets() != null) {
                        h.getPets().forEach(p -> {
                            if (p.getCategory() != null) {
                                categories.add(p.getCategory().name());
                            }
                        });
                    }
                    return categories;
                })
                .orElse(List.of());
    }

    public List<Household> getActiveHouseholds() {
        return repository.findByActiveTrue();
    }

    public boolean acquireLock(String userId, String executorName, int durationSeconds) {
        var now = Instant.now();
        var query = new Query(Criteria.where("user_id").is(userId)
                .andOperator(
                        new Criteria().orOperator(
                                Criteria.where("lock.locked").is(false),
                                Criteria.where("lock.until").lt(now)
                        )
                ));

        var update = new Update()
                .set("lock.locked", true)
                .set("lock.by", executorName)
                .set("lock.until", now.plusSeconds(durationSeconds));

        var result = mongoTemplate.findAndModify(
                query, update,
                FindAndModifyOptions.options().returnNew(true),
                Household.class
        );
        return result != null;
    }

    public boolean releaseLock(String userId, String executorName) {
        var query = new Query(Criteria.where("user_id").is(userId)
                .and("lock.by").is(executorName));

        var update = new Update()
                .set("lock.locked", false)
                .unset("lock.by")
                .unset("lock.until");

        var result = mongoTemplate.updateFirst(query, update, Household.class);
        return result.getModifiedCount() > 0;
    }
}
