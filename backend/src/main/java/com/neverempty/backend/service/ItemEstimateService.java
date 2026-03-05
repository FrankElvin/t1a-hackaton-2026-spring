package com.neverempty.backend.service;

import com.neverempty.backend.dto.EstimateDaysToRestockRequest;
import com.neverempty.backend.model.Household;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ItemEstimateService {

    private final LlmService llmService;
    private final HouseholdService householdService;

    public int estimateDaysToRestock(String userId, EstimateDaysToRestockRequest request) {
        var household = householdService.getByUserId(userId).orElse(null);
        var householdDesc = buildHouseholdDescription(household);

        LocalDate lastBought = null;
        if (request.lastBoughtDate() != null && !request.lastBoughtDate().isBlank()) {
            try {
                lastBought = LocalDate.parse(request.lastBoughtDate());
            } catch (Exception ignored) {
                // keep null
            }
        }
        if (lastBought == null) {
            lastBought = LocalDate.now();
        }

        var category = request.category() != null ? request.category() : "OTHER";
        var consumerCategory = request.consumerCategory() != null ? request.consumerCategory() : "";

        return llmService.estimateDaysToRestockWithHousehold(
                request.name(),
                request.quantity(),
                request.unit(),
                category,
                consumerCategory,
                householdDesc,
                lastBought);
    }

    private String buildHouseholdDescription(Household household) {
        if (household == null) {
            return "unknown";
        }
        var parts = new ArrayList<String>();
        if (household.getMembers() != null) {
            household.getMembers().stream()
                    .filter(m -> m.getCategory() != null)
                    .collect(Collectors.groupingBy(m -> m.getCategory().name(), Collectors.counting()))
                    .forEach((cat, count) -> parts.add(count + " " + cat));
        }
        if (household.getPets() != null) {
            household.getPets().stream()
                    .filter(p -> p.getCategory() != null)
                    .collect(Collectors.groupingBy(p -> p.getCategory().name(), Collectors.counting()))
                    .forEach((cat, count) -> parts.add(count + " " + cat));
        }
        return parts.isEmpty() ? "unknown" : String.join(", ", parts);
    }
}
