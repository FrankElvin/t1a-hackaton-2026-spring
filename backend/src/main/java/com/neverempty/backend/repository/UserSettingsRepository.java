package com.neverempty.backend.repository;

import com.neverempty.backend.model.UserSettings;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface UserSettingsRepository extends MongoRepository<UserSettings, String> {

    Optional<UserSettings> findByUserId(String userId);

    Optional<UserSettings> findByNotification_Email(String email);
}
