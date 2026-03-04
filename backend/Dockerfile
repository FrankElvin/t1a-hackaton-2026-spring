# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM eclipse-temurin:21-jdk-jammy AS builder
WORKDIR /app

# Copy dependency manifests first to exploit Docker layer caching
COPY gradle gradle
COPY gradlew .
COPY build.gradle.kts settings.gradle.kts gradle.properties ./
RUN chmod +x gradlew
# Increase heap for the build; resolve all deps before copying sources
RUN ./gradlew dependencies --no-daemon -Dorg.gradle.jvmargs=-Xmx1g

COPY src src
RUN ./gradlew bootJar --no-daemon -x test -Dorg.gradle.jvmargs=-Xmx1g

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app
COPY --from=builder /app/build/libs/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
