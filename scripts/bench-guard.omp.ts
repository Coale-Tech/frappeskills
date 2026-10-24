// omp hook adapter for bench-guard.sh. Install: copy or symlink to
// ~/.omp/agent/hooks/pre/bench-guard.ts (see docs/bench-guard.md).
// Re-uses the shell guard's rules: translates omp tool calls to the Claude Code
// PreToolUse payload, maps deny -> block, ask -> ctx.ui.confirm (block when no UI).
// Advisory guard, not a security boundary.
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const GUARD = join(dirname(fileURLToPath(import.meta.url)), "bench-guard.sh");

interface ToolCallEvent {
	toolName: string;
	input: Record<string, unknown>;
}
interface Ctx {
	hasUI?: boolean;
	ui: { confirm(title: string, message: string): Promise<boolean> };
}
interface HookAPI {
	on(
		event: "tool_call",
		handler: (e: ToolCallEvent, ctx: Ctx) => Promise<{ block: true; reason: string } | undefined>,
	): void;
}

// omp tools -> guard payloads.
// omp's tool_call event for `edit` includes derived `path`/`paths` fields (per omp extensions.md)
// for policy inspection. Fall back to parsing hashline headers (`[path#TAG]`) from `input` for
// environments that forward Claude Code's edit payload format instead.
function payloads(e: ToolCallEvent): Record<string, string>[] {
	const i = e.input;
	if (e.toolName === "bash") return [{ command: String(i.command ?? "") }];
	if (e.toolName === "write") return [{ file_path: String(i.path ?? "") }];
	if (e.toolName === "edit") {
		// Use omp-native derived fields when available.
		if (Array.isArray(i.paths) && i.paths.length > 0)
			return (i.paths as unknown[]).map((p) => ({ file_path: String(p) }));
		if (i.path) return [{ file_path: String(i.path) }];
		// Fallback: parse hashline headers from the raw `input` string (Claude Code edit format).
		const paths = [...String(i.input ?? "").matchAll(/^\[([^\]#\n]+)#/gm)].map((m) => m[1]);
		return paths.map((file_path) => ({ file_path }));
	}
	return [];
}

function decide(tool_input: Record<string, string>): { decision?: string; reason?: string } {
	const r = spawnSync("bash", [GUARD], {
		input: JSON.stringify({ tool_name: "omp", tool_input }),
		encoding: "utf8",
		timeout: 10_000,
	});
	// Guard failure -> ask, same fail-safe as the shell script.
	if (r.status !== 0) return { decision: "ask", reason: "[bench-guard] guard script failed" };
	try {
		const o = JSON.parse(r.stdout || "{}").hookSpecificOutput ?? {};
		return { decision: o.permissionDecision, reason: o.permissionDecisionReason };
	} catch {
		return { decision: "ask", reason: "[bench-guard] unparseable guard output" };
	}
}

export default function (pi: HookAPI): void {
	pi.on("tool_call", async (event, ctx) => {
		for (const p of payloads(event)) {
			const { decision, reason = "[bench-guard] flagged" } = decide(p);
			if (decision === "deny") return { block: true, reason };
			if (decision === "ask") {
				if (!ctx.hasUI) return { block: true, reason: `${reason} (no UI to confirm)` };
				if (!(await ctx.ui.confirm("bench-guard", reason))) return { block: true, reason: "user denied" };
			}
		}
	});
}
