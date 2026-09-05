# Maestro UI flows

One file per acceptance item, named after the phase it belongs to.

## Running

Maestro is not a repo dependency; it is installed per machine and is often not
on `PATH`. Use whichever resolves:

```bash
maestro test apps/mobile/.maestro/                 # when it is on PATH
~/.maestro/bin/maestro test apps/mobile/.maestro/  # default installer location
/tmp/maestro-dist/maestro/bin/maestro test apps/mobile/.maestro/  # this workstation
```

Flows expect a booted "iPhone 17 Pro" Simulator with a debug build installed
(`pnpm --filter @tally/mobile ios`) and Metro running.

`phase7-screens.yaml` and `phase7-dynamic-type.yaml` assert nothing — they only
file screenshots into `docs/screens/`. They carry the `docs` tag, so a sweep of
the whole directory should skip them:

```bash
maestro test --exclude-tags=docs apps/mobile/.maestro/
```

Screenshot paths are written relative to the Maestro output directory
(`~/.maestro/tests/<run>/<flow>/takeScreenshot/`), so copy them into the repo
after a run. Regenerating the reference captures, from `apps/mobile`:

```bash
xcrun simctl ui booted appearance light
maestro test -e MODE=light .maestro/phase7-screens.yaml
xcrun simctl ui booted appearance dark
maestro test -e MODE=dark .maestro/phase7-screens.yaml
xcrun simctl ui booted appearance light
xcrun simctl ui booted content_size extra-extra-extra-large
maestro test .maestro/phase7-dynamic-type.yaml
xcrun simctl ui booted content_size medium
```

`phase7-screens.yaml` deliberately leaves `MODE` out of its `env` block: this
Maestro build lets a flow's own `env` value win over `-e`, so a default there
would pin every run to one appearance and the second pass would overwrite the
first pass's files.

`phase7-offline.yaml` drives the `__DEV__`-only "Simulate offline" button on the
profile screen (`lib/online.ts`), because a Simulator cannot be taken off the
network from the host. It leaves the app online again.

## Fixtures

Every flow reads the data created by `apps/mobile/scripts/seed-dev.ts`, which
deletes and recreates its groups by invite code:

```bash
npx supabase projects api-keys --project-ref <ref> -o json > /tmp/keys.json
SUPABASE_KEYS_JSON=/tmp/keys.json node --experimental-strip-types apps/mobile/scripts/seed-dev.ts
```

Flows that write (settle, undo, hide, add expense) restore what they changed, so
the suite is re-runnable without a reseed. `scripts/expense-probe.ts` prints a
group's expenses with their splits, or purges the rows a flow left behind after
a mid-run failure:

```bash
node --experimental-strip-types apps/mobile/scripts/expense-probe.ts phase5ed
node --experimental-strip-types apps/mobile/scripts/expense-probe.ts phase5ex --purge Maestro
```

`phase5-detail-and-edit.yaml` edits an expense's description, which must leave
its locked rate and every `owed_amount_base` untouched. The UI cannot show that,
so bracket the flow with `scripts/verify-rate-lock.ts`:

```bash
node --experimental-strip-types apps/mobile/scripts/verify-rate-lock.ts phase5ed \
  --snapshot /tmp/phase5ed-before.json
maestro test apps/mobile/.maestro/phase5-detail-and-edit.yaml
node --experimental-strip-types apps/mobile/scripts/verify-rate-lock.ts phase5ed \
  --compare /tmp/phase5ed-before.json
```

`phase6-delete-account.yaml` consumes a throwaway account, so bracket it with the
fixture script, which also asserts the rows are gone:

```bash
node --experimental-strip-types apps/mobile/scripts/temp-account.ts create
maestro test apps/mobile/.maestro/phase6-delete-account.yaml
node --experimental-strip-types apps/mobile/scripts/temp-account.ts check
```

The account is deliberately only a *member* of its fixture group: `groups.created_by`
references `profiles(id)` with no ON DELETE action, so `delete-account` returns 500
for a user who still owns a group.

`scripts/verify-balances-parity.ts` is not a flow but belongs to the same
fixtures: it signs in as account A, calls `get_my_group_balances`, recomputes
the same numbers from the raw rows with `@tally/shared`'s `calculateNetBalances`,
and fails on any drift. The shared package is authored for bundlers, so it needs
the resolver shim:

```bash
SUPABASE_KEYS_JSON=/tmp/keys.json \
TALLY_TEST_EMAIL=... TALLY_TEST_PASSWORD=... \
  node --experimental-strip-types \
    --import ./apps/mobile/scripts/register-ts-resolver.mjs \
    apps/mobile/scripts/verify-balances-parity.ts
```

`phase6-profile-avatar.yaml` needs an image in the Simulator library
(`xcrun simctl addmedia booted <some.png>`), and `phase6-signout.yaml` is bracketed
with `scripts/push-tokens.ts` to watch the `device_tokens` row appear and vanish.

## Not covered here

`useRealtimeSync` needs a second writer, so D6 is checked by hand: park the app
on a group, insert an expense with the service role, and confirm the toast and
the new card appear within two seconds.

F1's "permission denied" half cannot be produced from a flow: Maestro's XCUITest
runner accepts the system permission alert on its own, so tapping "Turn on" always
grants. It is checked by hand by turning Tally's notifications off in iOS Settings
and reopening the settings screen, which must then read "Not allowed" and offer
"Open Settings". For the same reason `phase6-push-prompt.yaml` proves the alert was
raised by the status flipping from "Not asked yet" to "Enabled" rather than by
asserting on the alert itself.

F3 (a real push arriving on a device) is blocked: a Simulator cannot obtain an APNs
token, the project has no EAS `projectId` yet, and the `push-send` function has no
VAPID secrets configured. Debug builds substitute a fake `ExponentPushToken[sim-…]`
so the `device_tokens` plumbing is still exercised.

E2's negative half — a missing exchange rate must block the save — cannot be
provoked from the UI, because every currency the picker offers has a rate. It is
covered by `lib/expense-rate.test.ts` for the rule itself, and checked by hand by
making the `rates` query throw, running the probe flow, and confirming no row was
written:

```bash
maestro test <job dir>/e2-probe.yaml
node --experimental-strip-types apps/mobile/scripts/expense-probe.ts phase5ex
```
