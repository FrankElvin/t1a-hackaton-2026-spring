## Non-functional stack

| Concern | Choice |
|---|---|
| Auth | Keycloak (OIDC/JWT) |
| Keycloak storage | Postgres (or H2 for ephemeral demo) |
| Observability | OpenTelemetry SDK → OTLP → Honeycomb |
| Email transport | MailHog / Mailpit (demo) |
| Batch scheduling | 2 dedicated containers, each with internal scheduler; distributed locking via `findOneAndUpdate` on `household` |
| Deployment | Docker Compose |

## Functional stack

| Area | Choice |
|---|---|
| Java version | 21 (LTS) |
| Spring Boot | 3.4.x, Spring MVC (blocking) |
| Build tool | Gradle 8.x, Kotlin DSL (build.gradle.kts) |
| Database | MongoDB via Spring Data MongoDB |
| JWT validation | Spring Security OAuth2 Resource Server |
| Email | Spring Mail (JavaMailSender) |
| Batch services | 2 separate Spring Boot apps with @Scheduled |
| OTel (backend) | Micrometer Tracing + opentelemetry-exporter-otlp |
| Frontend framework | React + TypeScript, built with Vite |
| UI components | shadcn/ui (Tailwind CSS + Radix UI) |
| Frontend auth | keycloak-js adapter |
| Frontend HTTP | Axios |
| Frontend data fetching | TanStack Query (React Query) |
