# DSH Recovery Center / DSH 恢复中心

Local plugin recovery points for DeepSeek Harness, with a rescue interface that works even when the DSH frontend is broken.

**Preview:** tested with DSH **0.1.2-rc.1**, Node 22, macOS. Linux is implemented but not yet verified. Windows and supervised/Desktop restarts are not supported in this first release. Save a point before changing plugins. This is not a full DSH or workspace backup.

[中文使用说明](README.zh-CN.md)

## Languages

Chinese and English are included. Inside DSH, the navigation label and recovery panel follow Settings → General → Language immediately. The standalone rescue page follows the browser language, offers a 中文 / English selector, and remembers the choice. User-written recovery point names are preserved. CLI output follows LANG/LC_ALL or `--lang en` / `--lang zh`.

## Features

- Settings → **恢复中心**: save a named recovery point and restore it.
- Copies installed plugin files, not just package names: restore does not need npm or network access.
- SHA-256 verification before restore; refuse changed/corrupt points or different DSH versions.
- Automatically save a **before-restore** point so a restore can itself be undone.
- Staged file replacements and an on-disk journal for interruption recovery.
- Independent CLI/browser rescue copied outside the plugin directory on activation.
- No model-visible tools, telemetry, downloads, external scripts, or third-party API calls.

## Installation

Install from npm using the DSH CLI (then restart DSH):

```sh
dsh plugin --profile web add dsh-recovery-center@0.1.2 --config.auto-install-peers=false
```

Ensure `dsh-recovery-center` is in `package.json` → `dsh.profile.bundles` for this profile. Open Settings → 恢复中心 and save a first recovery point while the environment is healthy.

This release deliberately declares the tested DSH API versions. Do not force-install it into a different core version without retesting.

## What is restored

Only these paths inside the selected profile:

- `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`
- `cordis.yml`, `cordis.patch.yml`
- `node_modules/` including installed plugin bytes
- `.dsh-market/state.json`

Chat/session databases, workspaces, provider credentials, global settings, the DSH executable/core packages, and files outside the profile are not restored. Configuration embedded in the tracked files is captured; points are private local directories and must not be published.

Snapshots are profile-specific and machine-local. External dependency symlinks are rejected instead of producing an incomplete backup. Dangling internal links are preserved exactly, including old `.bin` shims. Installed copies of `file:` dependencies are captured, but their source directories are not. Do not install/update packages while taking a recovery point. Points are retained until manually removed while DSH is stopped; they consume roughly the installed dependency size (APFS clones can share disk blocks).

## Emergency recovery

On first activation, the plugin generates a runnable rescue launcher using that installation’s Node executable and data directory. On a local macOS installation, it also creates an executable `.command` on the current user’s Desktop (when the Desktop exists and is writable). Names include a per-installation identifier so multiple DSH profiles do not overwrite each other. Existing unrelated files are never overwritten. Set `desktopShortcut: false` to opt out. SSH launches do not create a desktop shortcut.

The recovery panel shows the actual launcher location and a **Create / repair launcher** button. On Linux, or if macOS Desktop access is unavailable, a `.sh` / `.command` is still saved in the independent rescue directory. This is on the **DSH host computer**, not necessarily the browser’s computer. Windows remains unsupported. Save at least one recovery point before experimenting with plugins.


The plugin copies its rescue runtime into:

```text
$DSH_HOME/recovery-center/<profile>/rescue/
```

`DSH_HOME` defaults to `~/.dsh`. This directory is outside the plugin tree and is preserved during restore/removal. Use Node 22+:

```sh
node "$DSH_HOME/recovery-center/web/rescue/cli.js" serve --store "$DSH_HOME/recovery-center/web" --open
```

The rescue server binds a random port on **127.0.0.1 only**. A random per-run token lives in the browser URL fragment and is sent in a custom request header. Leave the terminal open while using rescue; close it to stop the rescue server.

CLI alternatives:

```sh
dsh-recovery list --profile web
dsh-recovery capture --profile web --label "Before a new theme"
# Stop DSH first for these offline operations:
dsh-recovery restore <point-id> --profile web --yes
dsh-recovery repair --profile web
```

`repair` clears a lock only when its owning PID no longer exists and reverses a journaled interrupted restore. It refuses while the recorded DSH process exists. If a filesystem error prevents journal repair, keep the recovery directory intact for manual recovery.

## Restart behavior

The UI explicitly confirms task interruption. A detached worker validates the selected point, checks the recorded host process identity, asks that process to exit gracefully, restores the files, and relaunches its original command. It never kills a different PID owner and never force-kills an unresponsive host.

For launchd/systemd/pm2/Desktop or custom supervisors, set plugin config `allowRestart: false` and use the supervisor plus offline CLI restore. Detection is best-effort; do not assume arbitrary supervisors can be detected. Do not enable auto-restart for an unknown launch method.

## Development

No build tool or bundled third-party runtime is needed. The client registers a settings iframe using the DSH module factory contract, with React supplied by DSH. Host HTTP routes use the DSH authentication and origin fence. Mutations additionally require a same-origin JSON POST.

```sh
npm test
npm run check
npm pack
```

Publication in a plugin catalog is separate from npm publication. See `docs/PUBLISHING.md` in the source repository for the checklist.
