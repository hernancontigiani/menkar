# Locks and the running environment

Read this before you grant a verification, a build or any heavy work, and when a check fails in a
part nobody touched.

## Named locks

- Keep a few **named locks** that you grant and take back explicitly. Examples: the
  frontend build and visual check, the database's migration head, a shared catalog or fixture, a
  docs freeze before a release.
- **Editing your own files is free; verifying is not.** A build, a visual walk, a schema change, a
  full suite or a timing measurement needs the lock that covers it.
- A session releases a lock with an explicit message to you; you never assume it is free because
  the session went quiet.
- **Write the lock state where it survives a renew** (the project's status file or a small locks
  file): who holds what, since when, for which task. Your memory of it does not survive.

## Hidden shared resources

The files don't show everything sessions share. Seen in real runs:

- A full test suite that starts containers broke a concurrent browser walk (network errors from
  the container networks it created).
- A request made as a user changed that user's saved state (their last visited page), so the
  human's own app opened somewhere else.
- A timing measurement taken while other work ran measured the other work.

So, before you grant a verification:

- Check what else is running: processes, containers, load. Serialize heavy or noisy work.

## A failure nobody explains

A check that fails in a part no session touched is first suspected to be the environment: another
session's run, a container, a port, stale data. Check that before anyone changes code to fix it.
