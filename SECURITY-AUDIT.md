# Synapse Security and Safety Code Audit

**Scope:** `strotherdc-creator/Synapse`, `main` branch, audited August 2026. This is a repository and deployment-configuration review, not a penetration test. It distinguishes source-code evidence from configuration that requires authenticated Railway access.

## Executive Summary

The real Synapse codebase uses **Clerk** for identity, an Express/tRPC backend deployed on **Railway**, and a PostgreSQL connection supplied through `DATABASE_URL`. No Supabase package, environment-variable reference, client, migration, or schema integration exists in the repository. The live Railway health endpoint returned HTTP 200 during the audit.

The audit closed the most material code-level exposure found: the Communication Coach LLM endpoint was publicly callable before Clerk middleware and accepted unnecessarily large request bodies. It is now Clerk-authenticated, input-bounded, rate-limited per user in process, and returns generic internal errors. Direct dependencies were upgraded to patched releases for Clerk React, Drizzle ORM, Express, tRPC, and Nanoid. The full type check, 30 server tests, and the production build passed after these changes.

| Risk level | Status | Finding |
|---|---|---|
| Critical | None confirmed | No critical repository-level finding was identified in this review. |
| High | Fixed in code | The Communication Coach could consume paid LLM capacity without authentication or rate control. |
| High | Reduced | Direct dependencies with known advisories were upgraded: Clerk React, Drizzle ORM, Express, tRPC, and Nanoid. |
| High | Remaining transitive advisory | `lodash`, `js-cookie`, and `form-data` remain flagged through older Recharts, Clerk Express, and Groq SDK dependency paths. Their upgrade paths require compatibility testing, not a blind production bump. |
| Medium | Open | LLM-backed tRPC workflows do not yet have a shared distributed rate limiter across Railway instances. |
| Medium | Open | Railway variable values and database-service references could not be visually verified without authenticated Railway access. |
| Low | Open | The production Clerk publishable key is tracked in `.env.production`. It is public by design, but build-time configuration should still be centralized and documented. |

## Fixed Controls

### Communication Coach Access and Abuse Prevention

`POST /api/communication/generate` now requires a Clerk session, passes the Clerk bearer token from the client, rejects unauthenticated calls, limits each authenticated user to ten requests per minute in the running process, and bounds a conversation to 6,000 characters. The Express request parser limit was reduced from 50 MB to 1 MB. These controls follow the principle that each non-public endpoint should enforce local authorization and input limits, while costly endpoints should reject excessive request rates with HTTP 429.[1]

The server now removes the `X-Powered-By` header and sets MIME-sniffing, framing, referrer, and browser-permission controls. The LLM route also returns a generic failure message instead of passing provider details back to the client. This aligns with OWASP guidance to avoid technical details in API error responses and to use browser-facing security headers where APIs are consumed by browsers.[1]

### Authentication and Authorization

The tRPC application separates public procedures from `protectedProcedure` and `adminProcedure`, with Clerk JWT authentication resolved in the server request context. Public exposure was limited to the authenticated-user lookup and coupon-code validation; sensitive payment, administrative, WWLD, curriculum, and engagement operations require authenticated context. The Communication Coach route is now in the same Clerk-protected API boundary.

## Dependency Review

The production dependency audit was run before and after direct upgrades. The confirmed high-severity count fell from eight to three. The remaining alerts are transitive and are listed below rather than being force-upgraded without runtime compatibility validation.

| Remaining dependency path | Advisory class | Safe next action |
|---|---|---|
| `recharts → lodash 4.17.21` | Code injection / prototype-pollution advisories | Plan and test a Recharts v3 migration, or validate a package-manager override in staging. |
| `@clerk/express 1.x → js-cookie 3.0.5` | Prototype-hijack advisory | Test the Clerk Express v2 migration in a branch with production Clerk login flows. |
| `groq-sdk 0.9.x → form-data 4.0.4` | CRLF injection advisory | Upgrade Groq SDK in staging and run LLM fallback integration tests. |

## Data Safety and AI Safety

All reviewed database procedures scope user-owned records by the authenticated user ID. LLM calls remain server-side; Gemini and Groq credentials are not sent to the browser. The Communication Coach UI warns users not to send patient names, dates of birth, or protected health information. That warning should remain prominent because user-entered content is forwarded to third-party LLM providers.

The application still needs a shared rate-limit store or gateway-level rate limiting for all expensive LLM procedures. The new Communication Coach limiter is intentionally a local safety control; it resets on a restart and is not shared between multiple Railway instances. Authentication guidance also recommends monitoring automated abuse and applying context-appropriate re-authentication for sensitive changes.[2]

## Configuration Verification

| Component | Repository evidence | Verification status |
|---|---|---|
| GitHub source | `strotherdc-creator/Synapse`, `main` is the authoritative source branch. | Verified. |
| Railway application | Docker builds the React client and Express server; public health endpoint is live at `synapse-production-daae.up.railway.app`. | Verified at HTTP level. |
| Database | Drizzle and runtime server both require a PostgreSQL `DATABASE_URL`. The schema and migrations use PostgreSQL. | Verified in source; live value/service reference not inspected. |
| Clerk | Client uses `VITE_CLERK_PUBLISHABLE_KEY`; server requires `CLERK_SECRET_KEY` plus a publishable key for `/api` middleware. | Verified in source; live variable presence/value not inspected. |
| Supabase | No Supabase dependency, URL, key, client, migration, or schema reference exists in the repository. | No active code integration found. |
| LLM providers | Server environment schema supports `GEMINI_API_KEY` and optional `GROQ_API_KEY`. | Verified in source; live variable presence/value not inspected. |

The repository tracks `.env.production` with only `VITE_CLERK_PUBLISHABLE_KEY`; a Clerk publishable key is intended for client delivery and is not a secret. No database URL, Clerk secret key, LLM key, Stripe key, or SMTP credential was found in tracked configuration. Secrets should remain in Railway’s variable store, be limited by least privilege, and be rotated when exposed.[3]

## Required Railway Console Follow-up

The remaining configuration check is visual and should be performed only with values masked. On the Synapse application service, confirm that `DATABASE_URL`, `CLERK_SECRET_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`, and any enabled provider keys are present. Confirm that `DATABASE_URL` references the Railway PostgreSQL service’s **private** endpoint rather than a public proxy when both services live in the same project. If any `SUPABASE_*` variable appears, document its role before considering Supabase active; the repository presently does not use it.

## Verification Performed

TypeScript completed without errors. The full server test suite passed with 30 tests, including focused regression coverage for the Communication Coach security boundary, curriculum completion, daily streak behavior, and mobile coaching context. The Vite/Express production build passed. The public Railway health endpoint returned HTTP 200. No secret values were read or recorded during the audit.

## References

[1]: https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html "OWASP REST Security Cheat Sheet"
[2]: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html "OWASP Authentication Cheat Sheet"
[3]: https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html "OWASP Secrets Management Cheat Sheet"
