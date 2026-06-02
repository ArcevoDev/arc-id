# ArcID Engine

> Sovereign Decentralized Identity (DID) & Access Management Engine powering the ArcevoCirqle ecosystem.

---

## Architectural Modules

ArcID is split into decoupled domain components handling the complete authentication and verification loop:

- **Auth & Identity:** Passkeys (WebAuthn), session lifetimes, and multi-factor authentication (MFA).
- **OAuth/OIDC:** RFC-compliant token exchanges, authorization flows, JWKS endpoints, and discovery layouts.
- **Credentials:** Decentralized Identifier (DID) resolution, signing services, and Selective Disclosure JWT (SD-JWT) issuance.
- **Tenant Engine:** Multi-tenant isolation boundaries, membership layers, and cryptographic signing keys per tenant.
-
