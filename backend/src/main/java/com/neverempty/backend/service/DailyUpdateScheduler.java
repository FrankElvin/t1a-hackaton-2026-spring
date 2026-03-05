package com.neverempty.backend.service;

import com.neverempty.backend.repository.ItemRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class DailyUpdateScheduler {

    private final ItemRepository itemRepository;

    /**
     * Every day at midnight:
     * - daysToRestock = max(0, daysToRestock - 1)
     * - currentQuantity = max(0, currentQuantity - usagePerDay)
     *
     * Only runs for items where usagePerDay is set.
     */
    @Scheduled(cron = "0 0 0 * * *")
    public void dailyItemUpdate() {
        var items = itemRepository.findByUsagePerDayNotNull();
        for (var item : items) {
            if (item.getDaysToRestock() != null) {
                item.setDaysToRestock(Math.max(0.0, item.getDaysToRestock() - 1.0));
            }
            item.setCurrentQuantity(Math.max(0, item.getCurrentQuantity() - item.getUsagePerDay()));
        }
        itemRepository.saveAll(items);
        log.info("Daily item update: {} items updated", items.size());
    }
}
