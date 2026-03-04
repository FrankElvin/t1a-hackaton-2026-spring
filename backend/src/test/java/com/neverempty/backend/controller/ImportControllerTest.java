package com.neverempty.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.neverempty.backend.config.SecurityConfig;
import com.neverempty.backend.dto.ImportEmailRequest;
import com.neverempty.backend.dto.ImportReceiptResponse;
import com.neverempty.backend.model.Item;
import com.neverempty.backend.model.enums.ConsumerCategory;
import com.neverempty.backend.model.enums.ItemCategory;
import com.neverempty.backend.service.ImportService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ImportController.class)
@Import(SecurityConfig.class)
class ImportControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private ImportService importService;

    @Test
    void importReceipt_returns201() throws Exception {
        Item item = Item.builder()
                .id("item-1")
                .userId("user-1")
                .name("Milk")
                .category(ItemCategory.FOOD)
                .currentQuantity(2.0)
                .unit("pcs")
                .storeId("store-1")
                .price(3.99)
                .consumerCategory(ConsumerCategory.ADULT)
                .monthlyConsumptionRate(4.0)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();

        ImportReceiptResponse response = new ImportReceiptResponse(
                List.of(item),
                List.of("UNKNOWN LINE")
        );

        when(importService.importFromReceipt(eq("user-1"), any(byte[].class), eq("store-1")))
                .thenReturn(response);

        MockMultipartFile imageFile = new MockMultipartFile(
                "image", "receipt.png", MediaType.IMAGE_PNG_VALUE, "fake-image-data".getBytes()
        );

        mockMvc.perform(multipart("/api/v1/items/import/receipt")
                        .file(imageFile)
                        .param("storeId", "store-1")
                        .with(jwt().jwt(j -> j.subject("user-1"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.importedItems").isArray())
                .andExpect(jsonPath("$.importedItems[0].id").value("item-1"))
                .andExpect(jsonPath("$.importedItems[0].name").value("Milk"))
                .andExpect(jsonPath("$.unrecognizedLines[0]").value("UNKNOWN LINE"));
    }

    @Test
    void importEmail_returns201() throws Exception {
        Item item = Item.builder()
                .id("item-2")
                .userId("user-1")
                .name("Bread")
                .category(ItemCategory.FOOD)
                .currentQuantity(1.0)
                .unit("pcs")
                .price(2.50)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();

        ImportReceiptResponse response = new ImportReceiptResponse(
                List.of(item),
                List.of()
        );

        when(importService.importFromEmail(eq("user-1"), eq("raw email content")))
                .thenReturn(response);

        ImportEmailRequest request = new ImportEmailRequest("raw email content");

        mockMvc.perform(post("/api/v1/items/import/email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request))
                        .with(jwt().jwt(j -> j.subject("user-1"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.importedItems").isArray())
                .andExpect(jsonPath("$.importedItems[0].id").value("item-2"))
                .andExpect(jsonPath("$.importedItems[0].name").value("Bread"))
                .andExpect(jsonPath("$.unrecognizedLines").isEmpty());
    }

    @Test
    void importReceipt_unauthenticated_returns401() throws Exception {
        MockMultipartFile imageFile = new MockMultipartFile(
                "image", "receipt.png", MediaType.IMAGE_PNG_VALUE, "fake-image-data".getBytes()
        );

        mockMvc.perform(multipart("/api/v1/items/import/receipt")
                        .file(imageFile))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void importEmail_unauthenticated_returns401() throws Exception {
        ImportEmailRequest request = new ImportEmailRequest("raw email content");

        mockMvc.perform(post("/api/v1/items/import/email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }
}
