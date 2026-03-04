package com.neverempty.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.neverempty.backend.model.Household;
import com.neverempty.backend.model.enums.PersonCategory;
import com.neverempty.backend.model.enums.PetCategory;
import com.neverempty.backend.service.HouseholdService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(HouseholdController.class)
class HouseholdControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private HouseholdService householdService;

    private static final String USER_ID = "user-1";

    // ---- GET /api/v1/household ----

    @Test
    void getHousehold_returnsHousehold() throws Exception {
        var member = Household.Member.builder()
                .id("m1")
                .name("Alice")
                .category(PersonCategory.ADULT)
                .build();
        var pet = Household.Pet.builder()
                .id("p1")
                .name("Buddy")
                .category(PetCategory.DOG)
                .build();
        var household = Household.builder()
                .id("h1")
                .userId(USER_ID)
                .members(List.of(member))
                .pets(List.of(pet))
                .build();

        when(householdService.getByUserId(USER_ID)).thenReturn(Optional.of(household));

        mockMvc.perform(get("/api/v1/household")
                        .with(jwt().jwt(j -> j.subject(USER_ID))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("h1"))
                .andExpect(jsonPath("$.userId").value(USER_ID))
                .andExpect(jsonPath("$.members[0].name").value("Alice"))
                .andExpect(jsonPath("$.members[0].category").value("ADULT"))
                .andExpect(jsonPath("$.pets[0].name").value("Buddy"))
                .andExpect(jsonPath("$.pets[0].category").value("DOG"));
    }

    @Test
    void getHousehold_returns404WhenNotFound() throws Exception {
        when(householdService.getByUserId(USER_ID)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/v1/household")
                        .with(jwt().jwt(j -> j.subject(USER_ID))))
                .andExpect(status().isNotFound());
    }

    // ---- PUT /api/v1/household ----

    @Test
    void upsertHousehold_returnsUpdated() throws Exception {
        var household = Household.builder()
                .id("h1")
                .userId(USER_ID)
                .members(List.of(
                        Household.Member.builder().id("m1").name("Bob").category(PersonCategory.ADULT).build()
                ))
                .pets(List.of())
                .build();

        when(householdService.upsert(eq(USER_ID), any(Household.class))).thenReturn(household);

        mockMvc.perform(put("/api/v1/household")
                        .with(jwt().jwt(j -> j.subject(USER_ID)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(household)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("h1"))
                .andExpect(jsonPath("$.members[0].name").value("Bob"));
    }

    // ---- POST /api/v1/household/members ----

    @Test
    void addMember_returns201() throws Exception {
        var member = Household.Member.builder()
                .id("m-new")
                .name("Carol")
                .category(PersonCategory.CHILD)
                .build();

        when(householdService.addMember(eq(USER_ID), any(Household.Member.class))).thenReturn(member);

        var requestBody = Household.Member.builder()
                .name("Carol")
                .category(PersonCategory.CHILD)
                .build();

        mockMvc.perform(post("/api/v1/household/members")
                        .with(jwt().jwt(j -> j.subject(USER_ID)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(requestBody)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value("m-new"))
                .andExpect(jsonPath("$.name").value("Carol"))
                .andExpect(jsonPath("$.category").value("CHILD"));
    }

    // ---- DELETE /api/v1/household/members/{memberId} ----

    @Test
    void removeMember_returns204() throws Exception {
        when(householdService.removeMember(USER_ID, "m1")).thenReturn(true);

        mockMvc.perform(delete("/api/v1/household/members/m1")
                        .with(jwt().jwt(j -> j.subject(USER_ID))))
                .andExpect(status().isNoContent());
    }

    @Test
    void removeMember_returns404() throws Exception {
        when(householdService.removeMember(USER_ID, "nonexistent")).thenReturn(false);

        mockMvc.perform(delete("/api/v1/household/members/nonexistent")
                        .with(jwt().jwt(j -> j.subject(USER_ID))))
                .andExpect(status().isNotFound());
    }

    // ---- POST /api/v1/household/pets ----

    @Test
    void addPet_returns201() throws Exception {
        var pet = Household.Pet.builder()
                .id("p-new")
                .name("Whiskers")
                .category(PetCategory.CAT)
                .build();

        when(householdService.addPet(eq(USER_ID), any(Household.Pet.class))).thenReturn(pet);

        var requestBody = Household.Pet.builder()
                .name("Whiskers")
                .category(PetCategory.CAT)
                .build();

        mockMvc.perform(post("/api/v1/household/pets")
                        .with(jwt().jwt(j -> j.subject(USER_ID)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(requestBody)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value("p-new"))
                .andExpect(jsonPath("$.name").value("Whiskers"))
                .andExpect(jsonPath("$.category").value("CAT"));
    }

    // ---- DELETE /api/v1/household/pets/{petId} ----

    @Test
    void removePet_returns204() throws Exception {
        when(householdService.removePet(USER_ID, "p1")).thenReturn(true);

        mockMvc.perform(delete("/api/v1/household/pets/p1")
                        .with(jwt().jwt(j -> j.subject(USER_ID))))
                .andExpect(status().isNoContent());
    }

    @Test
    void removePet_returns404() throws Exception {
        when(householdService.removePet(USER_ID, "nonexistent")).thenReturn(false);

        mockMvc.perform(delete("/api/v1/household/pets/nonexistent")
                        .with(jwt().jwt(j -> j.subject(USER_ID))))
                .andExpect(status().isNotFound());
    }

    // ---- Unauthenticated ----

    @Test
    void unauthenticatedRequest_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/household"))
                .andExpect(status().isUnauthorized());
    }
}
