import { resolve } from "node:path";
import { realpathSync } from "node:fs";
import type { SessionInfo } from "./types.ts";

// Normalize a cwd for same-directory comparison. A raw string match ("a === b")
// hides genuine same-directory peers when two cwd strings differ only by a
// trailing slash, a "."/".." segment, or a symlink (e.g. macOS /tmp <->
// /private/tmp). resolve() collapses the lexical variants; realpathSync()
// collapses symlinks (best-effort: falls back to the resolved path if the
// directory no longer exists). Memoized — the set of distinct cwd strings is
// small and stable, so repeat comparisons are free after warmup.
const normalizeCache = new Map<string, string>();

export function normalizeCwd(cwd: string): string {
  const cached = normalizeCache.get(cwd);
  if (cached !== undefined) {
    return cached;
  }
  const resolved = resolve(cwd);
  let normalized: string;
  try {
    normalized = realpathSync(resolved);
  } catch {
    normalized = resolved;
  }
  normalizeCache.set(cwd, normalized);
  return normalized;
}

export function sameCwd(a: string, b: string): boolean {
  return normalizeCwd(a) === normalizeCwd(b);
}

export interface ProjectTargetResolution {
  kind: "found" | "missing";
  session?: SessionInfo;
  targetCwd: string;
  reason?: string;
}

function formatSessionRefs(sessions: SessionInfo[]): string {
  return sessions
    .map((session) => `${session.name || "Unnamed session"} (${session.id.slice(0, 8)})`)
    .join(", ");
}

export function resolveTargetInCwd(input: {
  sessions: SessionInfo[];
  currentSessionId: string;
  targetCwd: string;
  to?: string;
}): ProjectTargetResolution {
  const inCwd = input.sessions.filter((session) => sameCwd(session.cwd, input.targetCwd));
  const target = input.to?.trim();

  if (!target) {
    const candidates = inCwd.filter((session) => session.id !== input.currentSessionId);
    if (candidates.length === 1) {
      return { kind: "found", session: candidates[0], targetCwd: input.targetCwd };
    }
    if (candidates.length === 0) {
      return { kind: "missing", targetCwd: input.targetCwd, reason: `No other intercom sessions are connected in ${input.targetCwd}.` };
    }
    throw new Error(`Multiple intercom sessions are connected in ${input.targetCwd}: ${formatSessionRefs(candidates)}. Specify 'to'.`);
  }

  const byId = inCwd.find((session) => session.id === target);
  if (byId) return { kind: "found", session: byId, targetCwd: input.targetCwd };

  const lowerName = target.toLowerCase();
  const byName = inCwd.filter((session) => session.name?.toLowerCase() === lowerName);
  if (byName.length === 1) return { kind: "found", session: byName[0], targetCwd: input.targetCwd };
  if (byName.length > 1) {
    throw new Error(`Multiple intercom sessions named "${target}" are connected in ${input.targetCwd}: ${formatSessionRefs(byName)}. Address one by session ID.`);
  }

  const byIdPrefix = inCwd.filter((session) => session.id.startsWith(target));
  if (byIdPrefix.length === 1) return { kind: "found", session: byIdPrefix[0], targetCwd: input.targetCwd };
  if (byIdPrefix.length > 1) {
    throw new Error(`Multiple intercom sessions in ${input.targetCwd} match ID prefix "${target}". Use a longer session ID prefix.`);
  }

  return { kind: "missing", targetCwd: input.targetCwd, reason: `No intercom session matching "${target}" is connected in ${input.targetCwd}.` };
}
