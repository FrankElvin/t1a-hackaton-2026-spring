package com.neverempty.backend.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.neverempty.backend.config.AppProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * OpenAI-compatible LLM wrapper.
 * Adapts the algorithm from TestInvoiceParser/invoice_parser.py:
 * - Same chat completions API call pattern
 * - Temperature 0 for determinism
 * - Markdown fence stripping from response
 */
@Slf4j
@Service
public class LlmService {

    private static final String PARSE_EMAIL_PROMPT = """
            You are a purchase email parser.
            The user will provide the raw text or HTML of an order confirmation or receipt email.
            Extract every purchased item and return a JSON array.
            Each element must have:
            - "name": the FULL, human-readable product name. If the name is abbreviated or truncated, \
            expand it into a proper, recognizable product name in the original language.
            - "quantity": numeric quantity (e.g. 10 for "10szt", 2 for "2l", 500 for "500g", default 1)
            - "unit": measurement unit - extract from product name: "szt"/"pcs" for pieces, "L"/"l"/"ml" for volume, "g"/"kg" for weight. Use "pcs" when no unit in name.
            - "priceAmount": unit price as a number (e.g. 12.99)
            - "priceCurrency": 3-letter currency code (e.g. "USD", "EUR")
            - "shop": store/merchant name if identifiable, else null
            Rules:
            - Return ONLY a valid JSON array, no markdown fences, no extra text.
            - If no purchase items found, return [].
            """;

    private static final String PARSE_RECEIPT_PROMPT = """
            You are an OCR receipt parser.
            The user will provide raw OCR text extracted from a receipt photo.
            Extract every purchased item and return a JSON array.
            Each element must have:
            - "name": the FULL, human-readable product name. Receipt text is often abbreviated \
            (e.g. "Mleko sw 2%" → "Mleko świeże 2%", "Jaj Niespodz 20g" → "Jajko Niespodzianka 20g", \
            "Mar Rana 550g" → "Margaryna Rama 550g", "Cuk dr Dianant 1kg" → "Cukier Diamant 1kg", \
            "Sok Pon Riviva 2l" → "Sok Pomarańczowy Riviva 2l"). \
            Always expand abbreviations into proper, recognizable product names in the original language.
            - "quantity": numeric quantity (e.g. 10 for "10szt", 2 for "2l", 500 for "500g", default 1)
            - "unit": measurement unit - extract from product name: "szt"/"pcs" for pieces, "L"/"l"/"ml" for volume, "g"/"kg" for weight. Use "pcs" when no unit in name.
            - "priceAmount": unit price as a number
            - "priceCurrency": 3-letter currency code (e.g. "USD")
            - "shop": store name if visible at the top/bottom of receipt, else null
            Rules:
            - Return ONLY a valid JSON array, no markdown fences, no extra text.
            - If no items found, return [].
            """;

    private static final String CLASSIFY_CATEGORY_PROMPT = """
            You are a product categorizer.
            Given a product name (and optionally a description), return a single category string.
            Valid categories: grocery, household, pharmacy, pet, baby, electronics, clothing, other.
            Return ONLY the category string, nothing else.
            """;

    private static final String BATCH_CLASSIFY_PROMPT = """
            You are a household product classifier and consumption estimator.
            Given a JSON array of products, classify each one and estimate how many days \
            until a typical household runs out of it.

            Valid categories: grocery, household, pharmacy, pet, baby, electronics, clothing, other.

            Realistic consumption guidelines:
            - Milk (1L): ~3-5 days
            - Bread (500g): ~3-4 days
            - Eggs (10 pcs): ~7-10 days
            - Butter/Margarine (200-500g): ~14-21 days
            - Sugar (1kg): ~30-60 days
            - Oil (1L): ~30-45 days
            - Juice (1-2L): ~3-7 days
            - Cheese (200-400g): ~7-14 days
            - Cleaning products: ~30-90 days
            - Personal care: ~30-60 days
            Scale estimates based on actual quantity and number of consumers.

            Return ONLY a JSON array (no markdown fences) with one object per product:
            [{"name":"...","category":"...","runoutDays":...}, ...]
            The "name" must match the input exactly. "runoutDays" must be a positive integer.
            """;

    private static final String SUGGEST_MATCHES_PROMPT = """
            You are a product matching assistant.
            Given a product name (from a receipt or email) and a list of existing inventory item names,
            return which existing items likely match. Consider:
            - Same product in different languages (e.g. "Mleko" vs "Milk")
            - Abbreviations vs full names
            - Brand variations
            Return ONLY a JSON array of objects: [{"name":"<exact existing item name>","score":0.0-1.0}, ...]
            Order by score descending (best match first). Include only items with score >= 0.3.
            Use "name" exactly as it appears in the existing list. "score" is confidence 0-1.
            If no good matches, return [].
            """;

    private static final String SUGGEST_CONSUMERS_PROMPT = """
            You are a household consumption advisor.
            Given a product name and a list of household member categories,
            determine which members typically consume/use this product.
            Return a JSON array of matching category strings.
            Rules:
            - Return ONLY a valid JSON array.
            - If unsure, default to ["adult"].
            """;

    private static final String ESTIMATE_RUNOUT_PROMPT = """
            You are a household consumption estimator.
            Given a product with its name, quantity, category, and consumers,
            estimate the number of days until this product runs out for a typical household.
            Consider realistic consumption patterns:
            - Milk (1L): ~3-5 days
            - Bread (500g): ~3-4 days
            - Eggs (10 pcs): ~7-10 days
            - Butter/Margarine (200-500g): ~14-21 days
            - Sugar (1kg): ~30-60 days
            - Oil (1L): ~30-45 days
            - Juice (1-2L): ~3-7 days
            - Cheese (200-400g): ~7-14 days
            - Cleaning products: ~30-90 days
            - Personal care: ~30-60 days
            Scale estimates based on actual quantity and number of consumers.
            Return ONLY an integer (number of days). Nothing else.
            """;

    private final String apiKey;
    private final String baseUrl;
    private final String model;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    public LlmService(AppProperties properties, ObjectMapper objectMapper) {
        this.apiKey = properties.openai().apiKey();
        this.baseUrl = properties.openai().baseUrl();
        this.model = properties.openai().model();
        this.restTemplate = new RestTemplate();
        this.objectMapper = objectMapper;
    }

    public record ParsedProduct(
            String name,
            double quantity,
            String unit,
            double priceAmount,
            String priceCurrency,
            String shop
    ) {}

    public record ClassifiedProduct(
            String name,
            String category,
            int runoutDays
    ) {}

    public List<ParsedProduct> parseEmail(String emailBody) {
        var raw = callLlm(PARSE_EMAIL_PROMPT, emailBody);
        return parseJsonList(raw, new TypeReference<>() {});
    }

    public List<ParsedProduct> parseReceipt(String ocrText) {
        var raw = callLlm(PARSE_RECEIPT_PROMPT, ocrText);
        return parseJsonList(raw, new TypeReference<>() {});
    }

    public String classifyCategory(String productName) {
        return callLlm(CLASSIFY_CATEGORY_PROMPT, productName).toLowerCase().trim();
    }

    /**
     * Classify all products in a single LLM call: category + runout days.
     */
    public List<ClassifiedProduct> classifyAll(List<ParsedProduct> products) {
        var input = products.stream()
                .map(p -> Map.of("name", p.name(), "quantity", p.quantity()))
                .toList();
        String userContent;
        try {
            userContent = objectMapper.writeValueAsString(input);
        } catch (Exception e) {
            throw new RuntimeException("Failed to serialize products for batch classification", e);
        }
        var raw = callLlm(BATCH_CLASSIFY_PROMPT, userContent);
        return parseJsonList(raw, new TypeReference<>() {});
    }

    public List<String> suggestConsumers(String productName, List<String> householdCategories) {
        var content = "Product: %s\nHousehold members: %s".formatted(productName, householdCategories);
        var raw = callLlm(SUGGEST_CONSUMERS_PROMPT, content);
        return parseJsonList(raw, new TypeReference<>() {});
    }

    public record MatchCandidate(String name, double score) {}

    public List<MatchCandidate> suggestMatches(String parsedProductName, List<String> existingItemNames) {
        if (existingItemNames == null || existingItemNames.isEmpty()) {
            return List.of();
        }
        String userContent = "Parsed product: %s\nExisting items: %s"
                .formatted(parsedProductName, String.join(", ", existingItemNames));
        try {
            var raw = callLlm(SUGGEST_MATCHES_PROMPT, userContent);
            var list = parseJsonList(raw, new TypeReference<List<Map<String, Object>>>() {});
            return list.stream()
                    .map(m -> new MatchCandidate(
                            (String) m.get("name"),
                            ((Number) m.getOrDefault("score", 0.5)).doubleValue()
                    ))
                    .filter(c -> c.name() != null && !c.name().isBlank())
                    .limit(10)
                    .toList();
        } catch (Exception e) {
            log.warn("LLM suggest matches failed for '{}': {}", parsedProductName, e.getMessage());
            return List.of();
        }
    }

    public int estimateRunoutDays(String name, double quantity, String category,
                                   List<String> consumers, LocalDate lastBought) {
        var content = """
                Product: %s
                Quantity: %s
                Category: %s
                Consumers: %s
                Last bought: %s
                """.formatted(name, quantity, category, consumers, lastBought);
        var raw = callLlm(ESTIMATE_RUNOUT_PROMPT, content).trim();
        try {
            return Integer.parseInt(raw);
        } catch (NumberFormatException e) {
            log.warn("LLM returned non-integer for runout estimation: '{}', defaulting to 7", raw);
            return 7;
        }
    }

    /**
     * Core LLM call. Mirrors the pattern from invoice_parser.py:
     * - POST to /chat/completions
     * - temperature = 0
     * - Strip markdown code fences from response
     */
    private String callLlm(String systemPrompt, String userContent) {
        var url = baseUrl.endsWith("/") ? baseUrl + "chat/completions" : baseUrl + "/chat/completions";

        var headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiKey);

        var body = Map.of(
                "model", model,
                "temperature", 0,
                "messages", List.of(
                        Map.of("role", "system", "content", systemPrompt),
                        Map.of("role", "user", "content", userContent)
                )
        );

        var request = new HttpEntity<>(body, headers);
        var response = restTemplate.postForObject(url, request, Map.class);

        @SuppressWarnings("unchecked")
        var choices = (List<Map<String, Object>>) response.get("choices");
        @SuppressWarnings("unchecked")
        var message = (Map<String, Object>) choices.get(0).get("message");
        var raw = ((String) message.get("content")).strip();

        return stripMarkdownFences(raw);
    }

    /**
     * Strip markdown code fences if the model wraps the output.
     * Same logic as invoice_parser.py lines 48-52.
     */
    private static String stripMarkdownFences(String raw) {
        if (raw.startsWith("```")) {
            int newline = raw.indexOf('\n');
            raw = newline >= 0 ? raw.substring(newline + 1) : raw.substring(3);
            if (raw.endsWith("```")) {
                raw = raw.substring(0, raw.length() - 3);
            }
            raw = raw.strip();
        }
        return raw;
    }

    private <T> T parseJsonList(String json, TypeReference<T> typeRef) {
        try {
            return objectMapper.readValue(json, typeRef);
        } catch (Exception e) {
            log.error("Failed to parse LLM JSON response: {}", json, e);
            throw new RuntimeException("Failed to parse LLM response", e);
        }
    }
}
