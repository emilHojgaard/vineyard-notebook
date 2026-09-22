# Security hardening deployment notes

This change moves authorization into Firestore rules and the calendar functions.
Deploy both together:

```sh
firebase deploy --only firestore:rules,functions
```

## Data migration

New season, inventory, and library documents include `revision: 1` and immutable
partition fields (`projectId`; inventory also has `year`). Season writes use
separate `structure` and `content` fields. Existing season documents with a legacy `root` field are read compatibly and
are migrated to that split on their next successful save. Existing
inventory/library documents are similarly upgraded on their next save. The
rules allow exactly this one-time legacy upgrade (revision 1); afterwards they
require the new revision and reject partition changes.

The season `locked` field is server-visible. While it is true, Firestore permits
node content updates but rejects structural (`structure`) changes. The UI
padlock now persists this field. Completed seasons, and their inventory, are
read-only at the rules boundary.

## Collaboration policy

Collaborative season, inventory, and library writes use monotonically increasing
revisions. A stale revision is rejected (`ConcurrentWriteError`) rather than
silently overwritten; the user must reload and retry. This is intentionally
conflict rejection, not last-write-wins.

Invitation acceptance runs through the `acceptInvitation` callable because a
client-side Firestore rule cannot safely correlate a project membership update
with an invitation document. The calendar HTTP feed checks the token owner's
current project membership on every request, so removing a member invalidates
feed access immediately.
