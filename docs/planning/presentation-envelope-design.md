# Presentation Envelope Design — ArcVerify Integration

> **✅ Built — shipped in 0.1.0.** `jws-proof.ts` (6 unit tests),
> `verify-session.route.ts` (5 tests), `verify-present.route.ts` (9 tests).
> This document is kept as a reference for the design rationale; the actual
> implementation may differ in detail from what's described below.

## Problem

ArcVerify (or any relying party) needs to ask ArcWallet "prove you hold
credential X." The current stack can verify a VC in isolation
(`verifyCredentialFlow`), but there's no way for a third party to bind
that verification to a real-time challenge — without which any
credential presentation is subject to replay.

A full OIDC4VP / Presentation Exchange implementation is deferred to v2.
This design covers a lightweight, expressive enough container that ArcID
can host for ArcWallet via a simple two-step protocol.

## Flow (conceptual)

```
ArcVerify                   ArcID                          ArcWallet
   |                          |                               |
   |  1. POST /verify/session |                               |
   |     { credentialRef }    |                               |
   |                          |                               |
   |  2. ← { sessionId,     }|                               |
   |       challenge (nonce) }|                               |
   |                          |                               |
   |  3. ArcVerify passes      |                               |
   |     sessionId + challenge |                               |
   |     to ArcWallet (deep    |                               |
   |     link / QR code)       |                               |
   |                          |                               |
   |                          |  4. POST /verify/present       |
   |                          |     { sessionId,               |
   |                          |       challenge,               |
   |                          |       credential,              |
   |                          |       proof: JWS signed with   |
   |                          |         holder's did:key }     |
   |                          |                               |
   |  5. ← { valid: bool,   }|                               |
   |       claims }           |                               |
```

## Data structures (draft)

```typescript
// 1. ArcVerify initiates a session
POST /verify/session
Body: {
  credentialRef: string; // opaque hint — credential type or ID
}
Response: {
  sessionId: string; // short-lived (5 min TTL)
  challenge: string; // random nonce (base64url, 32 bytes)
}

// 2. ArcWallet presents
POST /verify/present
Body: {
  sessionId: string;
  credential: string; // the VC JWT
  proof: string; // detached JWS signed with holder's did:key
  // protected header: { alg: "EdDSA", kid: "<did:key>#key-1" }
  // payload: { nonce: <challenge>, sessionId, credentialHash }
}
Response: {
  valid: boolean;
  claims?: Record<string, unknown>;
  reason?: string;
}
```

## Where the existing pieces fit

1. **`verifyCredentialFlow`** handles step 5's core check: the credential's
   signature, expiry, and status-list revocation. It already supports both
   local DIDs (our didRecords) and remote `did:web` DIDs.

2. **The `proof` JWS** wraps the challenge + credential binding. It is signed
   by the holder with their identity-owned `did:key` (registered via the
   `wallet-did` flow). ArcID:
   - Looks up the `did:key` in its own DB (fast path).
   - Verifies the JWS signature against the stored public key.
   - Checks the nonce matches a live session (anti-replay).
   - Hashes the credential and checks the proof binds the same credential.

3. **`nonce` is never reused**: session rows expire after 5 minutes or
   first use, whichever comes first.

## Why not a full Vp / VerifiablePresentation

OIDC4VP / W3C Vp requires `@context`, `type`, potentially `presentationSubmission`
matching a `PresentationDefinition`. None of ArcVerify needs that complexity
— ArcVerify and ArcWallet are both first-party apps you control. The hash +
nonce envelope is sufficient for v1 and can be embedded inside a real
`VerifiablePresentation` later without changing the verification path.

## Implementation notes (built — verify against actual code)

**All of the following are implemented, not planned:**
- `VerifySession` model + `VerifySessionStatus` enum — schema + migration done
- `POST /verify/session` — unauthenticated, rate-limited (30/min/IP), 32-byte challenge, 5-min TTL
- `POST /verify/present` — unauthenticated, rate-limited, JWS proof verification via `jws-proof.ts`
- Proof helper: `verifyDetachedJws(proof, expectedNonce, expectedCredentialHash, didKey, db)` in `src/lib/security/jws-proof.ts`
- Anti-replay: CONSUMED/EXPIRED sessions return 410, used-once enforced
- See `src/modules/credentials/routes/verify-session.route.ts`, `verify-present.route.ts`, `src/lib/security/jws-proof.ts`
