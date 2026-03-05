package com.neverempty.backend.service;

import com.neverempty.backend.dto.MatchSuggestion;
import com.neverempty.backend.model.Item;
import com.neverempty.backend.repository.ItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ItemMatchService {

    private final ItemRepository itemRepository;
    private final LlmService llmService;

    public List<MatchSuggestion> suggestMatches(String userId, String productName) {
        List<Item> items = itemRepository.findByUserId(userId);
        if (items.isEmpty()) return List.of();

        List<String> names = items.stream().map(Item::getName).distinct().toList();
        var candidates = llmService.suggestMatches(productName, names);
        Map<String, String> nameToId = items.stream()
                .collect(Collectors.toMap(Item::getName, Item::getId, (a, b) -> a));

        return candidates.stream()
                .filter(c -> nameToId.containsKey(c.name()))
                .map(c -> new MatchSuggestion(nameToId.get(c.name()), c.name(), c.score()))
                .limit(8)
                .toList();
    }
}
