# Repository Development Instructions

## Architecture governance

Before changing code, read the architecture document for every affected subproject:

- Admin frontend: `admin-Base/ARCHITECTURE.md`
- Go backend and database: `admin-Base/backend/ARCHITECTURE.md`
- Mini-app frontend: `mobile-app/ARCHITECTURE.md`

All new features and refactors must follow those documents. If a requirement genuinely needs a different architecture, update the relevant architecture document in the same change and explain the reason. Do not silently introduce a second pattern.

For changes spanning subprojects, preserve these contracts:

- `/api/v1` is the admin API; `/api/mini` is the mini-app API.
- The backend is the source of truth for entitlement and monetization rules.
- API DTO changes must be reflected in the corresponding frontend types and services.
- Business times are stored and transported as UTC; each frontend follows its documented display timezone.
- IAA and IAP remain mutually exclusive application-level monetization modes.

Use the validation commands listed in each affected architecture document before completing a change.
