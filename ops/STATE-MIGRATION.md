# ESIEE: private runtime directory / candidate procedure (NOT executed on production)

Scope

Only cache/users paths are configurable. ESIEE_DATA_DIR unset preserves the old
relative CWD filenames. Explicit constructor filenames still win. Set the env
before importing app.py (global managers initialize at import). An explicitly
empty/relative env or a non-private directory fails startup. Missing directory
is created 0700; this is NOT migration. Changing the env never imports old state.
Whitelist, auth, PostHog, source, API contracts and public whitelist are unchanged.
New users files are 0600; existing permissions are not silently rewritten.
Migration installs cache/users 0600 and the dedicated directory 0700, owner equal
to the actual image process UID/GID (currently Dockerfile UID 1000; inspect GID).
Keep ESIEE_DATA_DIR outside the checkout/build context. No data in Git/images.
Dockerfile copies only Python files and public whitelist; .dockerignore is an
allowlist, excluding private JSON even if accidentally left in api/.

Local qualification

    PYTHONDONTWRITEBYTECODE=1 python tools/run_offline_tests.py

All new tests use temporary synthetic disks. Original cache and PostHog tests
are retained; SDK is mocked and socket/DNS access is rejected during discovery
and execution. No normal app startup, school request, real users/cache or capture.
The migration CLI has no network or service-control functionality. Its explicit
--api-quiesced flag acknowledges an operational prerequisite, not proof of it.
Source metadata and hashes are checked twice across the whole capture, copies
are read back, files/directories fsynced. This detects observed races but is not
a replacement for stopping writers. Snapshots/manifests remain private on VPS.
Never serve these directories via HTTP, sync them or publish them as CI artifacts.

Future authorized cutover (operator/parent only, after independent delta review)

1. Before any stop: record native application config/version, Git branch/HEAD,
   image ID/digest, actual process UID/GID, service/task count and all mounts.
   Retain exact old image locally (no prune). Back up current native config.
   Build/qualify exact approved commit without private data, then finish its CI.
   Confirm the old image can run `python /app/app.py` from a different CWD in an
   isolated --network none rehearsal with synthetic state. Local tests exercise
   the baseline managers by-path; that is not qualification of a live old image.
2. During the separately authorized window, quiesce ONLY the API service: no
   concurrent old/new task, request writer, background cleanup or rolling overlap.
   Dokploy autoDeploy and concurrent operators must not race this transaction.
   No Hermes fence/drain, no frontend or unrelated service stop. Record zero API
   writer tasks. Export /app/esiee_cache.json, /app/esiee_users.json and the original
   whitelist from the stopped, retained API container into a private VPS staging
   directory. Preserve stat information (e.g. local docker cp -a) and compare
   streaming hashes/stat with the stopped container before accepting the export.
   Docker cp can copy from a stopped container; retain it until full acceptance.
   Never use the earlier optimistic preflight backup as a final writer fence.
3. The source is the private stopped-container export, NOT the running layer.
   Precreate a private, operator-controlled VPS parent /srv/esiee-state (0700).
   Use unique nonexistent names for each capture/install; no concurrent publisher.
   Substitute actual confirmed UID/GID and absolute paths below:

    python ops/migrate_state.py capture --source /srv/esiee-state/stopped-export --destination /srv/esiee-state/final-backup --uid 1000 --gid 1000 --api-quiesced --include-whitelist
    python ops/migrate_state.py install --source /srv/esiee-state/final-backup --destination /srv/esiee-state/data --uid 1000 --gid 1000 --api-quiesced

   The first snapshot includes all three files. Install validates hashes and
   publishes ONLY cache/users, never overwrites a destination, never merges JSON.
   Manifest records source modes/UID/GID/mtime/ctime/inode/device/size and SHA256,
   plus destination metadata. Destination is deliberately hardened to 0600/0700,
   not mode-identical to a historical 0644 source. Byte hashes must be identical.
   Read manifests privately; verify mode/UID/GID and hashes against final export.
   Retain whitelist bytes unchanged: do not replace the public whitelist with
   private data or change its path/auth behavior.
4. Configure one dedicated DIRECTORY bind /srv/esiee-state/data -> /var/lib/esiee
   read-write, ESIEE_DATA_DIR=/var/lib/esiee. This remains private VPS data; it is
   not a network volume, registry layer or CI artifact. Do NOT bind the JSON
   cache file: atomic os.replace needs same-directory temporary + rename.
   Do NOT mount over /app. Do not add a Dockerfile VOLUME that creates anonymous
   empty state. A named volume is also possible but is not the qualified path.
   Verify native config readback has the exact mount/env BEFORE app starts.
   With no API writers, run only a no-network preboot inspection with the image
   UID/GID to verify visibility and hashes at /var/lib/esiee, not app.py. Refuse
   empty/mismatched files, wrong owner, node placement or missing bind. A missing
   bind otherwise permits ephemeral empty directory creation: this is a hard
   operational preboot gate, not something the env alone can prove.
5. Start ONLY the exact qualified API artifact after mount/preload readback.
   Do not use a rolling start while old API still writes. Native Dokploy may
   recreate services; verify service mounts/replicas/node placement. Keep state
   on the same VPS/node (or explicit placement), not an unproven cluster share.
   Read back actual commit/image ID, env/mount, health, and private state metadata.
   Never assert disk users equals boot snapshot after new logins: expected writes
   may change it. Never POST refresh to prove deployment. Observe existing health
   only, note source-data limitation. Frontend unchanged and not restarted here.

Rollback: never blindly restore the preboot backup over post-start users

A. Quiesce ONLY the new API again. Capture CURRENT directory to a NEW private
   snapshot, which includes every post-start user/session/reservation byte:

    python ops/migrate_state.py capture --source /srv/esiee-state/data --destination /srv/esiee-state/rollback-current --uid 1000 --gid 1000 --api-quiesced
    python ops/migrate_state.py install --source /srv/esiee-state/rollback-current --destination /srv/esiee-state/rollback-data --uid 1000 --gid 1000 --api-quiesced

B. Restore code to the exact retained OLD image, but preserve CURRENT state by
   path. Old code uses CWD-relative cache/users: set working directory
   /var/lib/esiee, command `python /app/app.py`, bind rollback-data as the dedicated
   directory /var/lib/esiee. Do not rely on ESIEE_DATA_DIR in an image that lacks
   this feature. To keep the old whitelist contract identical, stage a private
   WRITABLE copy of the current authoritative email_whitelist.json as
   /srv/esiee-state/rollback-data/email_whitelist.json (0600, actual UID/GID).
   Export it from the stopped new API's /app directory and compare bytes/hash
   before startup; use the preboot whitelist backup ONLY if its hash still
   equals the authoritative file. A stale backup must not revert admin changes.
   This compatibility-only whitelist copy keeps old CWD-relative reads/writes
   working; the new app's configurable directory still concerns cache/users
   only. No new whitelist configuration or public file change. Do not mount the
   whitelist read-only: that would silently break its existing write contract.
   No real data is baked in the image. Rehearse with a synthetic whitelist.
C. With API still stopped, compare rollback-data to rollback-current; rehearse
   old-image by-path startup offline first. Only then start old code, verify health,
   owner/modes/mount/image and new users preserved. Never replace these files with
   final-backup merely to recover code. If current state is corrupt or cannot be
   exported, HOLD: manual recovery/reconciliation, not an automatic old snapshot.
   Native rollback/config restore must retain volume/CWD/command changes; blindly
   restoring the old no-mount service spec would discard new users. Keep all
   captures/images; no prune or restore of Dokploy DB is part of this candidate.

Native delivery / CAS proposal to parent (no change made in this run)

Prior native evidence: application.deploy accepts no commit SHA; clone uses
--branch and main autoDeploy=true. Pushing main would trigger API AND unchanged
frontend, watchPaths empty. No app test/build workflow existed in the tracked
checkout. The two remote workflows observed in preflight are dynamic Copilot
reviewers, not deployment pipelines; this run does not requery remote services.

Prefer a dedicated deploy/esiee-<approved-sha> branch pointing exactly to the
reviewed + CI-green commit, held immutable for this cutover. Preserve GitHub
sourceType/provider/repository/buildPath and native Dockerfile deployment.
After separate authorization, compare-and-set ONLY API's configured branch using
expected app ID/config version/old branch/main HEAD/service image; read back
branch/env/mounts/version before native deploy. If native API has no atomic CAS,
serialize under an exclusive operator window, compare immediately before write
and read immediately after; abort on any mismatch. A double read is not atomic
CAS. Prevent concurrent branch writes and verify remote branch SHA immediately
before/after clone; native branch alone is NOT cryptographic commit pinning.
Read back actual checked-out commit/build provenance/image digest, not tag or
health alone. Bind CI receipt to that commit; record exact build context hashes.
No provider/registry switch, new deploy framework, Git history rewrite or main
push is proposed. Frontend remains main and untouched. Keep autoDeploy setting;
while API points to deployment branch, main pushes no longer auto-deploy API.
After acceptance, separately authorize returning API branch to main only when
main equals the approved SHA and the potential auto-deploy effect is understood;
read back settings. This restores future main Git autoDeploy instead of silently
breaking it. If this cannot be safely serialized, HOLD rather than pretending
native supports SHA-pin. Parent owns the authorization; Thomas need not operate
these technical steps himself.

Normal existing school access (documented, NOT exercised here)

app.py __main__ calls get_cached_data: stale/absent cache triggers current-week
GET; absent usable data can cause force_refresh second attempt. Serving cached
helpers can refresh expired cache later as before. Extractor requests HTTPS
https://edt-consult.univ-eiffel.fr/jsp/custom/modules/plannings/anonymous_cal.jsp
with resources=410, projectId=1, calType=ical, nbWeeks=1,
displayConfigId=8, firstDate=Monday. Existing anonymous feed, requests timeout=30,
no new credentials, headers, auth flow, source or collection added. Existing
parser retains DTSTART/DTEND, SUMMARY and LOCATION (also used as room_full);
cache contains event/date/room/schedule/stat/availability information. The raw
feed may also carry other fields, but this parser does not retain DESCRIPTION
or UID. Source content may include course names, room locations and identifiers;
no claim that it is nonpersonal. Existing Google token verification and PostHog
behavior remain untouched. This run neither starts app.py nor refreshes school
nor captures telemetry. Empty source/cache observation remains unresolved: cache
integrity patches do NOT prove the school source now contains events.

Review request

Review ONLY the new delta against accepted-baseline.json / delta.patch in the
shipping report. Reuse accepted four-fix approval and original image preflight;
those do not validate the new packaging/CI/runtime artifact. Require a fresh image
build/test at the eventual approved commit, independent delta review, and live
preboot/rollback qualification in an authorized window before activation.
