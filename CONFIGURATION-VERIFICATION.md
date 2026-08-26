# Synapse Production Configuration Verification

This document records what can be verified from the authoritative Synapse repository and public Railway endpoint without disclosing or reading secret values.

| Layer | Expected configuration | Evidence | State |
|---|---|---|---|
| Source control | GitHub `strotherdc-creator/Synapse`, branch `main` | Fresh GitHub checkout and pushed commits | Confirmed |
| Deployment | Railway application at `https://synapse-production-daae.up.railway.app` | Public `/api/health` returned HTTP 200 | Confirmed |
| Server database | PostgreSQL `DATABASE_URL` | Drizzle config and runtime database module require this variable | Source-confirmed |
| Authentication | Clerk publishable and server secret keys | Client bootstrap and server auth middleware reference these names | Source-confirmed |
| Supabase | `SUPABASE_*` configuration and a client library would be required | No code or dependency reference exists | Not active in this repository |
| AI providers | Gemini required; Groq optional fallback | Runtime environment schema | Source-confirmed |

## Railway Variables to Confirm Visually

The Railway console should show the following names on the Synapse **application** service, with their values masked: `DATABASE_URL`, `CLERK_SECRET_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`, `GEMINI_API_KEY`, and any intentionally enabled `GROQ_API_KEY`, `STRIPE_*`, `SMTP_*`, or `CLIENT_URL` variables.

The PostgreSQL service should own its database credentials. The application should reference that service through `DATABASE_URL`, ideally via Railway’s private service network. The repository gives no evidence that Supabase is part of the active production data path.

## Current Boundary

The public Railway endpoint confirms application availability, but it cannot safely reveal private environment variables or database connection values. The final operational confirmation requires a masked Railway Variables screenshot or an authenticated console review.
