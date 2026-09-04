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

Flows that write (settle, undo, hide) restore what they changed, so the suite is
re-runnable without a reseed.

## Not covered here

`useRealtimeSync` needs a second writer, so D6 is checked by hand: park the app
on a group, insert an expense with the service role, and confirm the toast and
the new card appear within two seconds.
