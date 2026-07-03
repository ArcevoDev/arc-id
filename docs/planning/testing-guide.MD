# ArcID API Testing Guide

# Swagger UI + Postman — Complete Route Verification

## Setup

Start both services:

```bash
pnpm dev:api      # http://localhost:4000
pnpm dev:workers  # background webhook worker
pnpm dev:web      # http://localhost:3000 (for mail preview)
```

Swagger UI → http://localhost:4000/docs  
Mail preview → http://localhost:3000/mail/preview  
Authorize in Swagger: click **Authorize** → paste Bearer token from login response.

---

## BLOCK 1 — System health (no auth)

| #   | Method | Path                                | Expected                              |
| --- | ------ | ----------------------------------- | ------------------------------------- |
| 1   | GET    | `/health/live`                      | `{ status: "ok", probe: "liveness" }` |
| 2   | GET    | `/health/ready`                     | `{ status: "ok", db: "reachable" }`   |
| 3   | GET    | `/health`                           | `{ status: "healthy" }`               |
| 4   | GET    | `/.well-known/openid-configuration` | Full OIDC discovery doc               |
| 5   | GET    | `/.well-known/did.json`             | SYSTEM tenant DID doc                 |

Stop DB connection and retest #2 → expect `503`.

---

## BLOCK 2 — Registration & email verification

| #   | Method | Path             | Body                        | Expected                                  |
| --- | ------ | ---------------- | --------------------------- | ----------------------------------------- |
| 6   | POST   | `/auth/register` | `{ email, password, name }` | `201` identity object, status `PENDING`   |
| 7   | POST   | `/auth/register` | same email again            | `409 CONFLICT`                            |
| 8   | POST   | `/auth/register` | 6 times from same IP        | `429 TOO_MANY_REQUESTS` (hits 5/hr limit) |

After step 6, check mail preview for `VERIFY_EMAIL` token. Copy it.

| #   | Method | Path                 | Body                        | Expected                                |
| --- | ------ | -------------------- | --------------------------- | --------------------------------------- |
| 9   | POST   | `/auth/email-verify` | `{ token: "<from email>" }` | `200`, identity status becomes `ACTIVE` |
| 10  | POST   | `/auth/email-verify` | same token again            | `400 TOKEN_INVALID` (consumed)          |

---

## BLOCK 3 — Login & session

| #   | Method | Path          | Body                  | Expected                                 |
| --- | ------ | ------------- | --------------------- | ---------------------------------------- |
| 11  | POST   | `/auth/login` | `{ email, password }` | `200` with `accessToken`, `refreshToken` |
| 12  | POST   | `/auth/login` | wrong password × 10   | `429` (10/min limit)                     |
| 13  | POST   | `/auth/login` | unverified account    | `401 UNAUTHORIZED`                       |

Save `accessToken` as `$TOKEN`. Click **Authorize** in Swagger and paste it.

| #   | Method | Path                 | Expected                |
| --- | ------ | -------------------- | ----------------------- |
| 14  | GET    | `/auth/sessions`     | List of active sessions |
| 15  | DELETE | `/auth/sessions/:id` | Revoke a session        |

---

## BLOCK 4 — Token lifecycle (OAuth)

First register an OAuth client:

| #   | Method | Path             | Body                                                                                               | Expected                              |
| --- | ------ | ---------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------- |
| 16  | POST   | `/oauth/clients` | `{ name, redirectUris: ["http://localhost:3000/callback"], scopes: ["openid","profile","email"] }` | `201` with `clientId`, `clientSecret` |
| 17  | GET    | `/oauth/clients` | —                                                                                                  | List registered clients               |

Authorization Code flow:

| #   | Method | Path                                                                                                                                                         | Expected                     |
| --- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- |
| 18  | GET    | `/oauth/authorize?response_type=code&client_id=<id>&redirect_uri=...&scope=openid+profile&code_challenge=<SHA256>&code_challenge_method=S256&state=<random>` | `302` redirect with `?code=` |

In Swagger you'll need to copy the URL manually into your browser to follow the redirect. In Postman, disable redirect following.

| #   | Method | Path                | Body                                                                                                                | Expected                                    |
| --- | ------ | ------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| 19  | POST   | `/oauth/token`      | `grant_type=authorization_code&code=<code>&code_verifier=<verifier>&client_id=...&client_secret=...` (form-encoded) | `access_token`, `refresh_token`, `id_token` |
| 20  | POST   | `/oauth/introspect` | `token=<access_token>&client_id=...&client_secret=...`                                                              | `{ active: true, sub, scope, ... }`         |
| 21  | POST   | `/oauth/token`      | `grant_type=refresh_token&refresh_token=<token>&client_id=...&client_secret=...`                                    | New token pair, old refresh invalidated     |
| 22  | POST   | `/oauth/token`      | old refresh token again                                                                                             | `400 invalid_grant` (reuse detection)       |
| 23  | POST   | `/oauth/revoke`     | `token=<access_token>&client_id=...&client_secret=...`                                                              | `200`                                       |
| 24  | POST   | `/oauth/introspect` | revoked token                                                                                                       | `{ active: false }`                         |
| 25  | GET    | `/oauth/userinfo`   | Bearer revoked token                                                                                                | `401`                                       |

---

## BLOCK 5 — MFA

| #   | Method | Path                | Expected                                                       |
| --- | ------ | ------------------- | -------------------------------------------------------------- | ---------------------------------- |
| 26  | POST   | `/auth/mfa/setup`   | `{ secret, qrCode, uri }` — scan QR in Authenticator app       |
| 27  | POST   | `/auth/mfa/confirm` | `{ code: "123456" }` → `{ recoveryCodes: [...] }` — save these |
| 28  | POST   | `/auth/logout`      | — clears session                                               |
| 29  | POST   | `/auth/login`       | `{ email, password }`                                          | `{ requiresMfa: true, sessionId }` |
| 30  | POST   | `/auth/mfa/verify`  | `{ code: "123456", sessionId }`                                | Full token pair returned           |
| 31  | POST   | `/auth/mfa/verify`  | recovery code from step 27                                     | Also works, marks code consumed    |
| 32  | POST   | `/auth/mfa/verify`  | used recovery code again                                       | `401`                              |

---

## BLOCK 6 — Step-up auth

| #   | Method | Path            | Body                           | Expected                                        |
| --- | ------ | --------------- | ------------------------------ | ----------------------------------------------- |
| 33  | DELETE | `/auth/profile` | —                              | `403 STEP_UP_REQUIRED` (delete needs elevation) |
| 34  | POST   | `/auth/step-up` | `{ password: "yourpassword" }` | `200` — session elevatedAt updated              |
| 35  | DELETE | `/auth/profile` | —                              | `200` — now succeeds within 15-min window       |

---

## BLOCK 7 — Passkeys (WebAuthn)

These need a browser / Postman with WebAuthn support or a manual flow.

| #   | Method | Path                             | Expected                                                |
| --- | ------ | -------------------------------- | ------------------------------------------------------- |
| 36  | POST   | `/auth/passkey/register/options` | Registration options + challenge                        |
| 37  | POST   | `/auth/passkey/register/verify`  | `{ credential: <authenticator response> }` → `200`      |
| 38  | GET    | `/auth/passkey`                  | List registered passkeys                                |
| 39  | DELETE | `/auth/passkey/:passkeyId`       | Requires `requireElevated` — do step-up first           |
| 40  | POST   | `/auth/passkey/auth/options`     | Auth challenge                                          |
| 41  | POST   | `/auth/passkey/auth/verify`      | `{ credential }` → full token pair, `authLevel: "aal2"` |

---

## BLOCK 8 — Password flows

| #   | Method | Path                           | Body                               | Expected                             |
| --- | ------ | ------------------------------ | ---------------------------------- | ------------------------------------ |
| 42  | POST   | `/auth/password/request-reset` | `{ email }`                        | `200` — check mail preview for token |
| 43  | POST   | `/auth/password/confirm-reset` | `{ token, newPassword }`           | `200` — old sessions revoked         |
| 44  | POST   | `/auth/password/change`        | `{ currentPassword, newPassword }` | Needs step-up — do block 6 first     |

---

## BLOCK 9 — Tenant management

| #   | Method | Path                            | Body                                 | Expected                                     |
| --- | ------ | ------------------------------- | ------------------------------------ | -------------------------------------------- |
| 45  | POST   | `/api/v1/tenants`               | `{ name: "Acme Inc", slug: "acme" }` | `201` — you are now ADMIN                    |
| 46  | GET    | `/api/v1/tenants/acme`          | —                                    | `200` — your tenant data                     |
| 47  | GET    | `/api/v1/tenants/system-global` | —                                    | `404 NOT FOUND` — you're not a SYSTEM member |

Step 47 verifies the membership gate fix: non-members cannot enumerate tenant data by slug.

| #   | Method | Path                                | Body                                                | Expected                                   |
| --- | ------ | ----------------------------------- | --------------------------------------------------- | ------------------------------------------ |
| 48  | POST   | `/api/v1/tenants/:tenantId/members` | `{ identityId: "<other user id>", role: "MEMBER" }` | `201` — check mail preview for invite link |
| 49  | POST   | `/invites/accept`                   | `{ token: "<from email>" }`                         | `200 "You have joined Acme Inc"`           |
| 50  | POST   | `/invites/accept`                   | same token again                                    | `410 INVITE_EXPIRED_OR_USED`               |

---

## BLOCK 10 — Credentials (VC)

Requires an ACTIVE tenant signing key. Create one first:

| #   | Method | Path                                     | Body                                                    | Expected                          |
| --- | ------ | ---------------------------------------- | ------------------------------------------------------- | --------------------------------- |
| 51  | POST   | `/api/v1/tenants/:tenantId/signing-keys` | `{ algorithm: "ES256" }`                                | `201` with `kid`                  |
| 52  | GET    | `/api/v1/tenants/acme/jwks`              | —                                                       | Public JWKS for Acme              |
| 53  | POST   | `/api/v1/credentials/issue`              | `{ subjectDid, credentialType, claims: { name, org } }` | `201` with `vc` string            |
| 54  | POST   | `/api/v1/credentials/verify`             | `{ vc: "<vc string>" }`                                 | `200 valid: true`                 |
| 55  | POST   | `/api/v1/credentials/:id/revoke`         | —                                                       | `200`                             |
| 56  | POST   | `/api/v1/credentials/verify`             | same vc                                                 | `200 valid: false, revoked: true` |

---

## BLOCK 11 — Webhooks

| #   | Method | Path                                  | Body                                                               | Expected                                                           |
| --- | ------ | ------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| 57  | POST   | `/api/v1/webhooks/endpoints`          | `{ url: "https://webhook.site/xxx", events: ["USER_REGISTERED"] }` | `201`                                                              |
| 58  | GET    | `/api/v1/webhooks/endpoints`          | —                                                                  | List endpoints                                                     |
| 59  | POST   | `/api/v1/webhooks/endpoints/:id/test` | —                                                                  | Sends a test ping — verify in webhook.site                         |
| 60  | POST   | `/auth/register`                      | new email                                                          | `201` — webhook worker delivers `USER_REGISTERED` to your endpoint |

---

## BLOCK 12 — Admin routes

| #   | Method | Path                       | Expected                                |
| --- | ------ | -------------------------- | --------------------------------------- |
| 61  | GET    | `/api/v1/admin/identities` | `403` unless you have SYSTEM ADMIN role |

Promote yourself in seed or directly:

```sql
-- psql
UPDATE "TenantMembership"
SET "roleId" = (SELECT id FROM "Role" WHERE "tenantId" = 'SYSTEM' AND name = 'ADMIN')
WHERE "identityId" = '<your-id>'
  AND "tenantId" = 'SYSTEM';
```

| #   | Method | Path                                  | Expected                          |
| --- | ------ | ------------------------------------- | --------------------------------- |
| 62  | GET    | `/api/v1/admin/identities`            | All identities                    |
| 63  | PATCH  | `/api/v1/admin/identities/:id/status` | `{ status: "SUSPENDED" }` → `200` |

---

## BLOCK 13 — Audit log

| #   | Method | Path                                      | Expected                          |
| --- | ------ | ----------------------------------------- | --------------------------------- |
| 64  | GET    | `/api/v1/audit`                           | Paginated log of your own actions |
| 65  | GET    | `/api/v1/audit?action=USER_LOGIN_SUCCESS` | Filtered                          |

---

## Social login & IdP federation — implemented, not 501

These are fully implemented and registered. They are NOT expected to return 501.
Behavior depends on environment configuration:

- `GET /auth/social/:provider` (google, github, apple, microsoft)
  and `/auth/social/:provider/callback`
  → Requires provider credentials in env (e.g. GOOGLE_CLIENT_ID/SECRET,
  GITHUB_CLIENT_ID/SECRET, APPLE_CLIENT_ID/TEAM_ID/KEY_ID/PRIVATE_KEY,
  MICROSOFT_CLIENT_ID/SECRET + SOCIAL_REDIRECT_URI).
  → If unconfigured: throws "X OAuth not configured" (500), not 501.
  → If configured: redirects to provider, then on callback validates
  state/PKCE cookies, links/creates Identity + OAuthAccount, issues
  ArcID token pair.

- `GET /idp/saml/:tenantSlug/metadata` and `POST /idp/saml/:tenantSlug/callback`
  → SAML2 SP metadata + ACS. Requires an active IdpConnection row
  (protocol=SAML2) for the tenant with entryPoint + cert configured.
  Falls back to minimal metadata XML if not yet configured.

- `GET /idp/oidc/:tenantSlug/callback`
  → OIDC federation callback. Requires an active IdpConnection row
  (protocol=OIDC or OAUTH2) with clientId/clientSecret + issuer or
  metadataUrl. Verifies id_token via jose.jwtVerify() against the
  IdP's JWKS.

- `POST /idp/connections` (+ GET/PATCH/DELETE)
  → ENTERPRISE plan required (requirePlan("ENTERPRISE")) + tenant ADMIN.
  Use this to set up an IdpConnection before testing the callback routes above.

To exercise these in a test environment without real IdP credentials,
either mock the provider/discovery endpoints, or skip these blocks and
note them as "requires external IdP — not covered by this run."

---

## Regression checks after each deployment

Run these 5 checks first — if any fail, something fundamental broke:

1. `GET /health/ready` → 200
2. `POST /auth/register` → 201
3. `POST /auth/login` → 200 with tokens
4. `GET /auth/sessions` (with token) → 200
5. `GET /.well-known/openid-configuration` → full doc

---

## Postman collection setup

1. Create an environment with variables: `BASE_URL=http://localhost:4000`, `TOKEN=`, `REFRESH_TOKEN=`
2. Add a test script to the login request:

```js
const body = pm.response.json();
pm.environment.set("TOKEN", body.data.accessToken);
pm.environment.set("REFRESH_TOKEN", body.data.refreshToken);
```

3. Set the collection-level Authorization to `Bearer {{TOKEN}}`
4. Override per-request for unauthenticated endpoints (set to `No Auth`)
