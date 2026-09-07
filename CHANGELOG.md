# Changelog

All notable changes to omp-intercom are documented here.

## [0.1.1] - 2026-09-07

### Changed
- New omp-intercom banner artwork.
- Release workflow switched to npm trusted publishing (OIDC), no token required.

### Fixed
- Removed `publishConfig.provenance` which broke local `npm publish`.

## [0.1.0] - 2026-09-07

Initial omp release, ported from [pi-intercom](https://github.com/earendil-works/pi-intercom) v0.13.0.

### Changed
- Extension targets the omp API: `@oh-my-pi/pi-coding-agent`, `@oh-my-pi/pi-tui`, `@oh-my-pi/pi-ai` package scopes, `omp` manifest field in `package.json` (with `pi` fallback retained).
- Overlay shortcut moved from Alt+M (reserved by omp) to **Alt+I**.
- Runtime state and config default to `~/.omp/agent/intercom`; `PI_CODING_AGENT_DIR` override retained to match omp's own agent-dir convention.
- Model presence refreshes at `turn_start` because omp has no `model_select` event.
- `StringEnum` tool schemas replaced with plain JSON Schema string enums (omp's `pi-ai` no longer exports `StringEnum`).
- Windows named pipe renamed to `omp-intercom-*`; broker protocol marker renamed to `omp-intercom`.
- Unnamed-session runtime alias prefix renamed from `subagent-chat-*` to `omp-chat-*`.
- Broker auto-spawn runs `broker.ts` directly when the host runtime is Bun; Node + bundled `tsx` remains the default under omp's compiled binary and under pi.
- Test suite runs on `bun test` (was `tsx --test`); `node:test` options converted to `bun:test` equivalents.
- `getAgentDirPath` prefers `$HOME`/`$USERPROFILE` over `os.homedir()` because Bun resolves the passwd entry at process start and ignores later env changes.

### Removed
- `contact_supervisor` tool and the `pi-subagents` bridge (child metadata env, `subagent:control-intercom` / `subagent:result-intercom` relay events). omp subagents coordinate through the built-in Agent Hub.
- Herdr project-pane integration (`openProjectPaneIfMissing`, `focus` params); `cwd` targeting remains for live sessions. `resolveTargetInCwd` moved to `cwd.ts`.
- `defineTool` wrapper — not exported by `@oh-my-pi/pi-coding-agent`; tools are plain objects now.
