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

## Not covered here

`useRealtimeSync` needs a second writer, so D6 is checked by hand: park the app
on a group, insert an expense with the service role, and confirm the toast and
the new card appear within two seconds.

E2's negative half — a missing exchange rate must block the save — cannot be
provoked from the UI, because every currency the picker offers has a rate. It is
covered by `lib/expense-rate.test.ts` for the rule itself, and checked by hand by
making the `rates` query throw, running the probe flow, and confirming no row was
written:

```bash
maestro test <job dir>/e2-probe.yaml
node --experimental-strip-types apps/mobile/scripts/expense-probe.ts phase5ex
```
