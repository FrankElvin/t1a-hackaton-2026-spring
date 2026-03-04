package com.neverempty.backend.model;

import com.neverempty.backend.model.enums.NotificationChannel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "user_settings")
public class UserSettings {

    @Id
    private String id;

    @Field("user_id")
    private String userId;

    private LocalDate calculationDate;

    @Builder.Default
    private NotificationConfig notification = new NotificationConfig();

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class NotificationConfig {
        private NotificationChannel channel = NotificationChannel.EMAIL;
        private String email;
        private boolean enabled = true;
        private int notifyDaysBeforeDepletion = 5;
        private int lookAheadDays = 7;
    }
}
