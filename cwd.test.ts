import { test } from "bun:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, symlinkSync, mkdirSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { normalizeCwd, sameCwd, resolveTargetInCwd } from "./cwd.ts";
import type { SessionInfo } from "./types.ts";

test("sameCwd collapses a trailing slash", () => {
  assert.equal(sameCwd("/usr/local", "/usr/local/"), true);
});

test("sameCwd collapses lexical '.' and '..' segments", () => {
  assert.equal(sameCwd("/usr/local/../local/./bin", "/usr/local/bin"), true);
});

test("sameCwd treats genuinely different directories as different", () => {
  assert.equal(sameCwd("/usr/local", "/usr/lib"), false);
});

test("sameCwd collapses a symlink to its real target", () => {
  const base = mkdtempSync(join(tmpdir(), "cwd-symlink-"));
  try {
    const real = join(base, "real");
    const link = join(base, "link");
    mkdirSync(real);
    symlinkSync(real, link);
    // Reached via the symlink vs its canonical path — must compare equal.
    assert.equal(sameCwd(link, real), true);
    // And normalizeCwd resolves the link to the real path.
    assert.equal(normalizeCwd(link), realpathSync(real));
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("normalizeCwd falls back to the resolved path for a nonexistent dir", () => {
  // realpathSync throws for a missing dir; normalizeCwd must still collapse the
  // lexical variants rather than throw.
  assert.equal(normalizeCwd("/no/such/dir/../dir"), "/no/such/dir");
});

function session(id: string, name: string | undefined, cwd: string): SessionInfo {
  return {
    id,
    ...(name ? { name } : {}),
    cwd,
    model: "test-model",
    pid: process.pid,
    startedAt: 1,
    lastActivity: 1,
  };
}

test("resolveTargetInCwd selects the sole peer in the requested cwd", () => {
  const resolved = resolveTargetInCwd({
    sessions: [
      session("self", "self", "/repo-a"),
      session("worker-a", "worker", "/repo-b"),
      session("worker-other", "worker", "/repo-c"),
    ],
    currentSessionId: "self",
    targetCwd: "/repo-b",
  });

  assert.equal(resolved.kind, "found");
  assert.equal(resolved.session?.id, "worker-a");
});

test("resolveTargetInCwd fails when a cwd has multiple possible peers and no target", () => {
  assert.throws(
    () => resolveTargetInCwd({
      sessions: [
        session("self", "self", "/repo-a"),
        session("worker-a", "worker-a", "/repo-b"),
        session("worker-b", "worker-b", "/repo-b"),
      ],
      currentSessionId: "self",
      targetCwd: "/repo-b",
    }),
    /Multiple intercom sessions are connected in \/repo-b/,
  );
});

test("resolveTargetInCwd scopes names to the requested cwd", () => {
  const resolved = resolveTargetInCwd({
    sessions: [
      session("self", "self", "/repo-a"),
      session("worker-a", "worker", "/repo-b"),
      session("worker-other", "worker", "/repo-c"),
    ],
    currentSessionId: "self",
    targetCwd: "/repo-b",
    to: "worker",
  });

  assert.equal(resolved.kind, "found");
  assert.equal(resolved.session?.id, "worker-a");
});
