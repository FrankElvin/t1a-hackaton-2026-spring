package com.neverempty.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public record AppProperties(
        OpenAi openai,
        Google google,
        Barcode barcode,
        Notification notification,
        String baseUrl
) {
    public record OpenAi(
            String apiKey,
            String baseUrl,
            String model
    ) {}

    public record Google(
            String credentialsPath,
            String gmailImpersonateEmail
    ) {}

    public record Barcode(
            String lookupKey
    ) {}

    public record Notification(
            int soonDays
    ) {}
}
