<p>
  <img src="banner.png" alt="omp-intercom" width="1100">
</p>

# Omp Intercom

Direct 1:1 messaging between [omp](https://github.com/can1357/oh-my-pi) sessions on the same machine. Send context, findings, or requests from one session to another — whether you're driving the conversation or letting agents coordinate.

Port of [pi-intercom](https://github.com/earendil-works/pi-intercom) to the omp extension API.

```text
User flow: press Alt+I or run /intercom to pick a session and send a message
```

## Why

Sometimes you're running multiple omp sessions — one researching, one executing, one reviewing. Omp-intercom lets you:

- **User-driven orchestration** — Send context or findings from your research session to your execution session
- **Agent collaboration** — An agent can reach out to another session when it needs help or wants to share results
- **Session awareness** — See what other omp sessions are running and their current status

This fills the gap omp's built-ins leave open: `/collab` shares *one* session with multiple viewers (1 agent, N humans), and the Agent Hub manages subagents *inside* one process. Omp-intercom connects two independent, fully separate omp instances as peers.

## In One Minute

Each omp session that has `omp-intercom` loaded and enabled connects to a tiny local broker over a local IPC transport. The broker keeps track of connected sessions and routes direct messages to the one you target by name or session ID. The extension gives you both a tool (`intercom`) and a small overlay UI (`/intercom` or `Alt+I`). Incoming messages are rendered inline inside the recipient session, can trigger a turn immediately by default, and are also stored in session history as extension entries. If you want a stricter local trust posture, `inboundTrigger` can reduce or disable auto-triggering.

## Install

```bash
omp install npm:omp-intercom
```

Then restart omp. The extension auto-connects to the broker on startup and registers the bundled `omp-intercom` skill for common coordination patterns.

The broker process is spawned on demand and runs TypeScript through the bundled `tsx` CLI, so a Node.js executable must be available on `PATH` (or set `brokerCommand`/`brokerArgs` in the config, e.g. to `bun`).

**Recommended:** Add this snippet to your project's `AGENTS.md` to help agents understand when to coordinate across sessions:

```xml
<omp-intercom>
Coordinate with other local omp sessions on related codebases. Use `/skill:omp-intercom` for patterns.

**When:** Same codebase (parallel work), reference codebase (consulting patterns), related repos (shared libraries).

**Not when:** Unrelated codebases, trivial questions, or when you can proceed independently.

**Principle:** Prefer `send` for notifications; `ask` only when blocked waiting for input.
</omp-intercom>
```

A session becomes intercom-connected when all of these are true:
- the `omp-intercom` extension is installed and loaded in that session
- `enabled` is not set to `false` in the intercom config file, which defaults to `~/.omp/agent/intercom/config.json`
- the session has started or reloaded after the extension was installed
- the local broker is running or can be auto-started

The session list only shows intercom-connected sessions, not every open omp process on the machine.

If a session is unnamed, omp-intercom exposes a collision-resistant runtime-only fallback alias like `omp-chat-1a2b3c4d-5e6f-7a8b` so other connected sessions can target it. That alias is not persisted as the omp session title or treated as a reconnect identity, so an unnamed process cannot inherit another unnamed session's queued mail after a restart.

### Name your current session

Use `/alias <name>` as an omp-intercom-friendly way to name the current session:

```text
/alias api-worker
```

The alias is omp's session name, so it is persisted in the session and immediately
published to omp-intercom peers. Session lists, send/reply results, overlays, and
incoming message headers use it when available. In an interactive UI, `/alias`
or `/alias menu` opens an input for the current session's alias; it does not
rename other sessions. Use `/alias <name>` in non-UI modes.

## Quick Start

### From the Keyboard

Press **Alt+I** or type `/intercom` to open the session list overlay:

1. **Select a session** — Use arrow keys to pick a target session
2. **Compose message** — Write your message in the compose overlay
3. **Send** — Press Enter to send, Escape to cancel

(Alt+M in pi-intercom is reserved by omp, so the shortcut moved to Alt+I.)

### From the Agent

The agent can list sessions and send messages using the `intercom` tool. Tool calls and results render as compact transcript rows so send/ask/reply flows are easy to scan. Use `/intercom-id` to insert a handoff snippet for the current session's stable intercom target into the editor. For common patterns like planner-worker delegation, the bundled `omp-intercom` skill provides copy-paste ready examples:

```typescript
// List active sessions
intercom({ action: "list" })
// → **Current session:**
// → • executor (20d43841) — ~/projects/api (kimi-k2 · 42% ctx) [self, idle]
// → **Other sessions:**
// → • research (6332faab) — ~/projects/api (kimi-k2) [same cwd, thinking]

// List only peers in the same working directory
intercom({ action: "list-cwd" })

// Send a message
intercom({ action: "send", to: "research", message: "Check if UserService.validate() handles null" })
// → Message sent to research

// Check connection status
intercom({ action: "status" })
// → Connected: Yes, Session ID: abc123, Active sessions: 3

// Send with attachments (code snippets, files, or context)
intercom({
  action: "send",
  to: "worker",
  message: "Here's the fix:",
  attachments: [{
    type: "snippet",
    name: "auth.ts",
    language: "typescript",
    content: "function validate() { ... }"
  }]
})
```

### Ask and wait for a reply

`ask` blocks until the target replies (10-minute default, configurable via `PI_INTERCOM_ASK_TIMEOUT_MS`):

```typescript
intercom({ action: "ask", to: "planner", message: "JWT or session cookies?" })
// → **Reply from planner:** Session cookies — we're browser-first.
```

Reply to an inbound ask naturally with `reply`:

```typescript
intercom({ action: "reply", message: "Session cookies — we're browser-first." })
```

### Target by working directory

Scope a send/ask to the sole live session in another repo:

```typescript
intercom({
  action: "send",
  cwd: "/home/me/projects/billing",
  message: "Let's discuss the billing retry design in this repo."
})
```

## Configuration

Create `~/.omp/agent/intercom/config.json`:

```json
{
  "enabled": true,
  "confirmSend": false,
  "inboundTrigger": "always",
  "sessionId": "stable-intercom-id"
}
```

| Key | Default | Meaning |
|-----|---------|---------|
| `enabled` | `true` | Set `false` to disconnect and hide intercom |
| `confirmSend` | `false` | Interactive confirmation before `send` |
| `inboundTrigger` | `"always"` | `"always"` triggers a turn on inbound messages; `"replies"` only triggers for ask replies; `"never"` renders inline without triggering |
| `sessionId` | unset | Pin a restart-stable intercom session ID |

By default, runtime state and config live under `~/.omp/agent/intercom`. If omp is launched with `PI_CODING_AGENT_DIR` (omp's own agent-dir override), omp-intercom uses `$PI_CODING_AGENT_DIR/intercom` instead, including `config.json`, broker PID/lock files, sockets, and launcher state.

## Runtime Files

Runtime files live at `~/.omp/agent/intercom/` by default, or `$PI_CODING_AGENT_DIR/intercom/` when `PI_CODING_AGENT_DIR` is set:

- `broker.sock` — Unix domain socket for communication (macOS/Linux only; Windows uses a named pipe instead)
- `broker-launch.vbs` — Windows helper script used to launch the broker without a console window
- `broker.pid` — Broker process ID
- `broker.spawn.lock` — Startup lock preventing double-spawn
- `pending-asks/` — Local records of blocking asks awaiting replies

## How It Works

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│ omp session │◄───────►│    broker    │◄───────►│ omp session │
│  (planner)  │  local  │ (auto-spawn) │  local  │  (worker)   │
└─────────────┘   IPC   └──────────────┘   IPC   └─────────────┘
```

- **Broker** — Tiny local process (`broker/broker.ts`) that tracks connected sessions and routes direct messages. Auto-spawns on first use; exits when idle.
- **Extension** — Each session runs `index.ts`, which registers the `intercom` tool, the `/intercom`, `/intercom-id`, `/alias` commands, the `Alt+I` shortcut, presence heartbeats, and the inline message renderer.
- **Transport** — Unix domain socket on macOS/Linux; named pipe on Windows (opt-in TCP loopback via `PI_INTERCOM_TRANSPORT=tcp` for restricted environments). Session IDs are the trusted addressing key; duplicate names fail closed on ambiguous sends.
- **Presence** — Sessions advertise name, cwd, model, context-window usage, and live status (`idle` / `thinking` / `tool:<name>`) so peers can pick a good target.
- **Mailbox** — Messages to recently disconnected named sessions are queued and redelivered when the same name+cwd reconnects. Runtime-only `omp-chat-...` aliases are not reconnect identities.

## Extension Channels

Other extensions in the same session can use omp-intercom as a message bus: register a namespace over the shared `pi.events` bus, get an owner-elected channel with per-namespace state, and publish/send payloads to the owning session. See `extension-api.ts` for the `INTERCOM_EXTENSION_REGISTER_EVENT` contract and the outbox request/result events for consent-gated sends.

## Differences from pi-intercom

- Targets the omp extension API (`@oh-my-pi/*` packages, `omp` package manifest)
- Shortcut is **Alt+I** (omp reserves Alt+M)
- Runtime state lives under `~/.omp/agent/intercom`
- Model presence refreshes at `turn_start` (omp has no `model_select` event)
- The `pi-subagents` bridge (`contact_supervisor`, subagent relay events) and the Herdr `openProjectPaneIfMissing` flow are not ported; omp's subagents communicate through the built-in Agent Hub instead
- Tests run on `bun test`

## Development

```bash
npm install
npm test    # bun test, 190 tests
```

The broker is runtime-agnostic (plain Node APIs); the extension and UI layers import `@oh-my-pi/*` packages and require Bun.

## License

MIT
