# ArcID v1 Roadmap — Verified Against Codebase

Scope note: ArcWallet and ArcVerify are confirmed in-code as first-party
`Project` rows under the same tenant (referenced directly in
`onboarding.service.ts` comments and the Swagger description). This means
v1 does not need spec-perfect OIDC4VCI/OIDC4VP — it needs a clean,
versioned wallet API that ArcWallet (a React Native app you control) can
consume via standard OAuth/PKCE against ArcID as a public client, built so
it can grow toward real OIDC4VCI/VP later without a rewrite. That single
decision removes the single largest, slowest item from the old roadmap and
replaces it with something achievable in weeks, not months.

Everything below was checked against the actual snapshot, not assumed from
file names. Where a prior review (ChatGPT) made a claim, I've noted whether
it held up.

---

## Corrections to the prior review, before the roadmap

These matter because building a roadmap on a wrong map wastes the weeks
that roadmap claims to save.

**Overstated — Credentials/SSI at "60% complete."** Real and good: W3C VC
issuance, SD-JWT with correct per-algorithm Web Crypto mapping, bitstring
status-list revocation, `did:web`. Nonexistent: `did:key`, `did:jwk`,
OIDC4VCI, OIDC4VP, BBS+. The protocol-interop layer is at 0%, not 60% — but
per the scope decision above, v1 doesn't need that layer to ship.

**Understated / missed entirely — two real signing/verification bugs.**
`verify-credential.flow.ts` hardcodes `importSPKI(pem, "ES256")` for
locally-issued DIDs regardless of the DID's actual `keyType`
(`Ed25519VerificationKey2020 | X25519KeyAgreementKey2020 | JsonWebKey2020 |
Multikey` — none of which are ES256). Signing reads the algorithm
dynamically; verification doesn't. Separately, `signing.service.ts`'s
`loadSigningKey` only resolves a key via `did.tenantId` — `TenantSigningKey`
has no `identityId` column, so issuance for an individually-owned DID
(`identityId` set, `tenantId` null) throws `"No active signing key found"`
every time. Both are scoped, fixable bugs, not roadmap items — see Phase 0.

**Real but mis-scoped — migration hygiene.** Not "too many migrations,
consolidate into a clean baseline" (risky, unnecessary for 25 migrations
over 3 weeks of active dev). The actual issue: one migration folder is
literally named `add_identity_banned_audit_action` but its SQL adds
`USERNAME_SET` — a copy-pasted folder name. Fix the name for future
clarity; don't touch applied migration history.

**Real but mis-scoped — "unused tables."** Checked every model against
actual usage. `ExternalIdentifier` and `LegalConsent` are schema-only, zero
usage — genuinely dead for now. `Wallet` is schema-only too, but it's not
dead, it's _pending_ — exactly what ArcWallet's account-linking will need.
`AccessDelegation` looked similarly suspicious by name but is fully wired
(`delegation.route.ts`, registered, working).

---

## Phase 0 — Fix what's actually broken (3–5 days)

Not roadmap-scale work — these are bugs sitting in code that otherwise
works, found by reading the actual signing/verification paths end to end.

1. **Verification algorithm mismatch.** ~~`verify-credential.flow.ts` must
   read the issuer DID's `keyType` (or better, look up the `kid`/algorithm
   from the credential's JWT header, which `signJwt` already sets) and
   select the correct `importSPKI`/verification algorithm instead of
   hardcoding ES256. Until this lands, any credential signed with a
   non-ES256 key fails to verify through your own endpoint.~~
   **✅ Done — reads `alg` from JWT header via `decodeProtectedHeader`.

2. **Identity-owned DID signing key gap.** ~~`signing.service.ts`'s
   `loadSigningKey` needs an `identityId` branch, or — more consistent with
   the current design — `TenantSigningKey` needs to support keys scoped to
   an `Identity` as well as a `Tenant`. Decide now whether v1 actually needs
   individually-owned DIDs (separate from tenant-issued ones) or whether
   that's a v2 feature; if it's v2, explicitly disable/validate against
   issuing identity-scoped DIDs for now so the failure is a clear 4xx
   instead of an opaque 500 at credential-issuance time.~~
   **✅ Done — identity-scoped DIDs rejected with ApiError.badRequest at issuance time (v2 feature).**

3. **Status-list index allocation race.** `allocateIndex`'s read
   (`issuedCount`) and write (`increment`) are two separate statements —
   concurrent issuance can hand out the same index twice. Make it a
   compare-and-swap (`updateMany` guarded on the observed `issuedCount`,
   retry on conflict), and run the allocation inside the same transaction
   as the `VerifiableCredential.create` so a crash mid-issuance can't leave
   an allocated-but-orphaned slot.

4. **Federated/social login account takeover via email match.** Both
   `social.route.ts`'s `handleCallback` and `idp.service.ts`'s
   `federatedLogin` silently link a new federated identity to any existing
   local account sharing the same email, with no check that the existing
   account's email is actually verified. Gate the auto-link on
   `existingIdentity.emailVerified === true`; otherwise fail with a clear
   "verify your email first, then link this provider from settings" error.
   Both call sites need the identical fix — patching one leaves the other
   exploitable.

5. **Seed script's `ADMIN_PASSWORD` default.** `prisma/seed.ts` falls back
   to a hardcoded, now-public password if the env var isn't set. Make it
   required (process.exit) when `NODE_ENV === "production"`, mirroring the
   `superRefine` pattern `env.validator.ts` already uses elsewhere.

6. **Misnamed migration folder.** Rename
   `20260617125316_add_identity_banned_audit_action` to something like
   `20260617125316_add_username_set_audit_action` for future readability.
   Do not edit the SQL inside it or touch already-applied migrations.

None of this blocks anything else below — do it first because it's cheap,
contained, and some of it (the email-linking bug) is a real security hole
that matters more once ArcWallet/ArcVerify start exchanging real identity
data.

---

## Phase 1 — Close the OAuth/aal gap for first-party apps (1 week)

This is the piece ArcWallet specifically needs and the prior session
identified but didn't fully scope: `TokenService.issue()`'s
`IssueTokensParams` interface has **no `aal` field at all** — assurance
level is tracked correctly server-side on `Session.authLevel` (and enforced
correctly by `auth-guard.plugin.ts` for step-up-gated routes), but it never
makes it into the JWT. For ArcWallet to make sensible client-side decisions
(e.g. "prompt for passkey before allowing a high-value credential request"),
it needs to see assurance level in its own token.

- Add `aal: "aal1" | "aal2"` to `IssueTokensParams`, thread it through both
  call sites that currently hardcode `authLevel: "aal1"` at session
  creation (`social.route.ts`, `idp.service.ts`) and the step-up path that
  already writes `authLevel: "aal2"` to the session.
- Add `aal` to both `accessTokenPromise` and `idClaims` in
  `token.service.ts`. Add `preferred_username` to `idClaims` from
  `identity.username` (the column exists, the migration landed, nothing
  reads it yet).
- Wire `setUsernameFlow` to an actual route — it's fully implemented
  (TOCTOU-safe, audit-logged) but `auth.plugin.ts` never registers it.
  Add it to the `/auth` route group or `profile.route.ts`, whichever fits
  your existing settings page better.
- Fix the refresh-token expiry/replay conflation: `token-refresh.flow.ts`
  triggers the full reuse-detected kill-chain (revoke entire family,
  invalidate session) for a token that simply expired naturally, not just
  for genuine replay. Distinguish "not found" (real attack signal) from
  "found but expired" (normal, expected) before deciding whether to nuke
  the session family — a found-but-expired token should just return a
  clean "token expired, please log in again" without revoking siblings
  that may still be validly in use elsewhere.

---

## Phase 2 — ArcWallet-facing API surface (2–3 weeks)

This replaces "OIDC4VCI/VP/BBS+" as a roadmap item with something
achievable now, designed to not paint you into a corner later.

- **Register ArcWallet as a real OAuth client.** Public client
  (`public: true`), `requirePkce: true`, scoped to a `Project` row
  (`category: "wallet"` or similar), redirect URIs pointed at the RN app's
  custom URI scheme or universal link. This is already fully supported by
  the schema and `authorize.flow.ts` — no backend work needed, just
  configuration + seeding the client.
- **Design (don't yet spec-comply with) a credential-offer shape.** Add a
  thin endpoint — e.g. `POST /credentials/offers` — that a tenant's backend
  calls to create a pending, short-lived "offer" row (subject DID or
  pending-binding token, credential type, claims) that ArcWallet then polls
  or deep-links into to accept and trigger the existing
  `issueCredentialFlow`. This gives you the wallet-initiated UX
  (user taps "Add to Wallet," wallet fetches the offer, wallet confirms)
  without committing to the full OIDC4VCI grant types yet. Structure the
  offer payload close enough to the real `credential_offer` shape (issuer,
  credential_configuration_ids equivalent, grant hint) that migrating to
  real OIDC4VCI later is a routing change, not a rewrite.
- **Wallet binding for `Wallet` model.** This table exists, is referenced
  in billing webhook comments, and is otherwise completely unused. Build
  the actual link: when ArcWallet first authenticates a user, create a
  `Wallet` row tying `provider`/`providerWalletId` to the `Identity`, so
  ArcVerify (or any other consumer) can later ask "does this identity have
  a linked wallet, and which DID(s) does it control."
- **Presentation, not full OIDC4VP.** ArcVerify needs to ask ArcWallet
  "show me credential X" and get a presentable, verifiable response. You
  already have `verifyCredentialFlow`, which does real signature + status
  - expiry checks. Add a presentation endpoint that wraps an existing VC
    in a lightweight signed envelope (could be as simple as having ArcWallet
    re-sign a nonce + credential reference with the user's own DID key, which
    `verifyCredentialFlow` can already validate) rather than building full
    Presentation Exchange / DIF PE matching now.

---

## Phase 3 — Security hardening that matters before any external users (2 weeks)

Most of ChatGPT's Priority 2/Phase M items are sound but undifferentiated.
Ranked by what's actually missing versus already handled:

- **Redis-backed distributed revocation** — real gap. `RevokedJti` exists
  as a table but a JTI blocklist check against Postgres on every request
  is the wrong access pattern at scale; this is genuinely worth doing
  before opening up beyond first-party apps.
- **CSRF on cookie-mutating routes** — check whether any session-cookie
  state exists yet (most of this API looks bearer-token-based via
  `Authorization` headers rather than cookies, which would make CSRF much
  less relevant than ChatGPT assumed — verify which routes, if any, rely on
  cookies before treating this as urgent).
- **SSRF on webhook/DID config loaders** — real and worth doing:
  `IdpConnection`'s `metadataUrl` and webhook `targetUrl` are both
  user-supplied URLs the server fetches; without an allowlist/private-IP
  block, this is a classic SSRF vector into your own infra.
- Distributed locks (BullMQ/Redis) for token refresh and credential
  issuance — lower priority than ChatGPT suggested, now that Phase 0 fixes
  the actual race condition in `allocateIndex` directly via compare-and-swap.
  A distributed lock is the heavier, more general version of the same fix;
  worth doing eventually, not blocking v1.

---

## Phase 4 — Observability (1 week, don't skip)

The one part of the old roadmap that's genuinely still greenfield and
genuinely needed: there is no tracing, no structured metrics, no
correlation IDs anywhere in this snapshot. Before ArcWallet and ArcVerify
both depend on ArcID in production, you need to be able to answer "why did
this specific login fail" without grepping raw logs. Minimum viable for v1:
request-correlation IDs threaded through `FlowContext` and into
`auditService` calls (the audit log already has the right shape to carry
this), plus basic P95/error-rate metrics on the auth and token-issuance
paths specifically, since those are the ones every other product depends on.

---

## What to explicitly defer past v1

- BBS+ / selective-disclosure-beyond-SD-JWT — SD-JWT VC is already
  implemented correctly and is the more practically wallet-compatible
  format right now; revisit BBS+ if a specific consumer needs it.
- `did:key` / `did:jwk` — add when a real consumer needs a DID method
  ArcID doesn't control resolution for; `did:web` covers your own-issued
  DIDs fine for a first-party wallet.
- Full OIDC4VCI/OIDC4VP spec compliance — revisit once ArcWallet is live
  and you have a concrete second wallet (or external consumer) that
  actually needs standards compliance rather than your own offer-shaped API.
- OPA/Cedar policy engine, SCIM, Terraform provider, CLI — all real v2+
  platform features, none block ArcWallet/ArcVerify shipping.
