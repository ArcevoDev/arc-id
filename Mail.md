# Mail Wiring Audit

`notificationService` has 13 email methods and 2 SMS methods defined.
Only **1** was wired before this review. The table below tracks every trigger.

| Method                  | Trigger location                                        | Status     | Notes                                                           |
| ----------------------- | ------------------------------------------------------- | ---------- | --------------------------------------------------------------- |
| `sendEmailVerification` | `auth/flows/register.flow.ts`                           | ✅ Done    | Called after identity + EmailToken creation                     |
| `sendWelcome`           | `auth/flows/register.flow.ts`                           | ⚠️ Missing | Should fire after `emailVerified = true` (in email-verify.flow) |
| `sendMagicLink`         | `auth/flows/login.flow.ts` or dedicated magic-link flow | ⚠️ Missing | Needed if magic-link auth is implemented                        |
| `sendPasswordReset`     | `auth/flows/password-reset-request.flow.ts`             | ⚠️ Missing | Must fire after EmailToken created for RESET_PASSWORD           |
| `sendPasswordChanged`   | `auth/flows/password-reset-confirm.flow.ts`             | ⚠️ Missing | Fire after password update confirmed                            |
| `sendPasswordChanged`   | `auth/flows/password-change.flow.ts`                    | ⚠️ Missing | Fire after in-session password change                           |
| `sendMfaCode`           | `auth/flows/mfa-verify.flow.ts` (EMAIL type)            | ⚠️ Missing | For EMAIL MFA type — TOTP doesn't need email                    |
| `sendRecoveryCodes`     | `auth/flows/mfa-setup.flow.ts` (confirm step)           | ⚠️ Missing | Fire after recovery codes are generated                         |
| `sendMfaDisabledAlert`  | `auth/flows/mfa-setup.flow.ts` (disable)                | ⚠️ Missing | Security alert when MFA is turned off                           |
| `sendNewDeviceLogin`    | `auth/flows/login.flow.ts`                              | ⚠️ Missing | When `Device` not seen before for this identity                 |
| `sendAccountSuspended`  | `modules/identity` admin action                         | ⚠️ Missing | When `status` transitions to `SUSPENDED`                        |
| `sendAccountDeletion`   | `modules/identity` delete flow                          | ⚠️ Missing | When identity is soft-deleted                                   |
| `sendTenantInvite`      | `tenant/flows/add-member.flow.ts`                       | ✅ Fixed   | Added in this review — uses membership.id as token placeholder  |
| `sendCredentialIssued`  | `credentials/flows/issue-credential.flow.ts`            | ⚠️ Missing | Fire after VC is persisted with holder email                    |
| `sendMfaCodeSms`        | `auth/flows/mfa-verify.flow.ts` (SMS type)              | ⚠️ Missing | For SMS MFA type via Brevo                                      |
| `sendSecurityAlertSms`  | Various security events                                 | ⚠️ Missing | Optional SMS for high-risk events                               |

---

## Quick wiring pattern

All flow files follow the same pattern — import once, call fire-and-forget:

```ts
import { notificationService } from "@/lib/notifications/notification.service";

// Inside execute():
void notificationService.sendPasswordReset(identity.primaryEmail!, token, {
  name: identity.name ?? undefined,
  ip: ctx.ip,
});
```

`void` discards the promise — mail failures must never crash auth flows.
The `sendEmail` wrapper in `notification.service.ts` already catches and logs all errors.

---

## sendWelcome placement decision

Two options:

- **On register** (before email verified) — user gets a friendly welcome but hasn't verified yet.
- **On email-verify** (after `emailVerified = true`) — cleaner trigger, account is truly active.

Recommended: fire in `email-verify.flow.ts` right after `status` → `ACTIVE`.

```ts
// email-verify.flow.ts — after the db.identity.update call
const identity = await ctx.db.identity.findUnique({
  where: { id: tokenRecord.identityId },
  select: { primaryEmail: true, name: true },
});
if (identity?.primaryEmail) {
  void notificationService.sendWelcome(identity.primaryEmail, {
    name: identity.name ?? undefined,
  });
}
```

---

## New-device detection pattern

In `login.flow.ts`, after session creation, check the Device table:

```ts
const knownDevice = await ctx.db.device.findFirst({
  where: {
    identityId: identity.id,
    userAgent: ctx.userAgent,
  },
});

if (!knownDevice && ctx.userAgent) {
  void notificationService.sendNewDeviceLogin(identity.primaryEmail!, {
    name: identity.name ?? undefined,
    ip: ctx.ip ?? "unknown",
    userAgent: ctx.userAgent,
  });
}
```

---

## Credential issued pattern

In `issue-credential.flow.ts`, after the VC is persisted:

```ts
if (input.holderId) {
  const holder = await ctx.db.identity.findUnique({
    where: { id: input.holderId },
    select: { primaryEmail: true, name: true },
  });
  if (holder?.primaryEmail) {
    void notificationService.sendCredentialIssued(holder.primaryEmail, {
      holderName: holder.name ?? undefined,
      credentialType: "VerifiableCredential",
      issuerName: tenantDid.id,
      credentialId: vcId,
      expiresAt: input.expiresAt,
    });
  }
}
```
