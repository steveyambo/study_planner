import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

class NextResponse extends Response {
  static redirect(destination, status) { return new NextResponse(null, { status, headers: { Location: String(destination) } }); }
}
function load(file, supabase) {
  const absolute = path.resolve(file);
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(absolute, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, URL, Date, Intl, require(name) {
    if (name === "next/server") return { NextResponse };
    if (name === "@/lib/supabase/require-user") return { requireUser: async () => ({ supabase, userId: "owner" }) };
    return load(name.startsWith("@/") ? `src/${name.slice(2)}.ts` : path.resolve(path.dirname(absolute), `${name}.ts`), supabase);
  } });
  return exports;
}
const id = "11111111-1111-1111-1111-111111111111";
function request(fields = { id }, origin = "http://localhost:3000") {
  const value = new Request("http://localhost:3000/dashboard/complete", { method: "POST", headers: { origin }, body: new URLSearchParams(fields) });
  value.nextUrl = new URL(value.url);
  return value;
}
const result = (response) => new URL(response.headers.get("Location")).searchParams.get("result");
test("completion rejects external or missing origins and invalid IDs before mutation", async () => {
  let calls = 0;
  const { POST } = load("src/app/dashboard/complete/route.ts", { rpc: async () => { calls++; } });
  assert.equal((await POST(request({ id }, "https://external.example"))).status, 403);
  assert.equal((await POST(request({ id }, ""))).status, 403);
  assert.equal(result(await POST(request({ id: "bad" }))), "invalid");
  assert.equal(calls, 0);
});
test("completion sends only the ID to authenticated RPC and reloads dashboard with no-store", async () => {
  const calls = [];
  const { POST } = load("src/app/dashboard/complete/route.ts", { rpc: async (...args) => { calls.push(args); return { data: "completed", error: null }; } });
  const response = await POST(request({ id, user_id: "attacker", status: "completed", completed_at: "1900-01-01" }));
  assert.equal(JSON.stringify(calls), JSON.stringify([["complete_study_session", { p_session_id: id }]]));
  assert.equal(response.status, 303);
  assert.equal(result(response), "completed");
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
});
test("missing migration, replaced proposal, future or cancelled session and failures never report success", async () => {
  for (const [output, expected] of [
    [{ data: "missing" }, "missing"], [{ data: "future" }, "future"], [{ data: "unavailable" }, "unavailable"],
    [{ error: { code: "PGRST202" } }, "migration"], [{ error: { code: "42501" } }, "failed"], [{ data: null }, "failed"],
  ]) {
    const { POST } = load("src/app/dashboard/complete/route.ts", { rpc: async () => output });
    assert.equal(result(await POST(request())), expected);
  }
  const { POST } = load("src/app/dashboard/complete/route.ts", { rpc: async () => { throw new Error("offline"); } });
  assert.equal(result(await POST(request())), "failed");
});
const { studySummary } = load("src/lib/dashboard/study-summary.ts");
const study = (id, scheduled_date, status, duration_minutes = 90, completed_at = null) => ({ id, scheduled_date, status, duration_minutes, completed_at });
test("daily and ISO-week totals exclude missed and cancelled; historical completions do not inflate today", () => {
  const summary = studySummary([
    study("done", "2026-10-04", "completed", 90, "2026-10-04T16:00:00Z"),
    study("next", "2026-10-04", "planned", 60), study("late", "2026-10-03", "planned", 30),
    study("missed", "2026-10-04", "missed"), study("cancelled", "2026-10-04", "cancelled"),
    study("future", "2026-10-05", "planned"), study("old", "2026-09-27", "completed", 120, "2026-10-03T16:00:00Z"),
  ], "2026-10-04");
  assert.equal(summary.weekStart, "2026-09-28"); assert.equal(summary.weekEnd, "2026-10-04");
  assert.equal(summary.dayMinutes, 150); assert.equal(summary.dayCompletedMinutes, 90);
  assert.equal(summary.weekMinutes, 180); assert.equal(summary.weekCompletedMinutes, 90);
  assert.equal(summary.overdue[0].id, "late"); assert.equal(summary.upcoming[0].id, "future");
  assert.equal(summary.completed[0].id, "done"); assert.equal(summary.missedCount, 1);
});
test("empty dashboard and Monday week boundary across a year remain valid", () => {
  const empty = studySummary([], "2026-10-03"); assert.equal(empty.weekMinutes, 0); assert.equal(empty.dayMinutes, 0);
  const monday = studySummary([], "2025-12-29"); assert.equal(monday.weekStart, "2025-12-29"); assert.equal(monday.weekEnd, "2026-01-04");
});
test("profile timezone determines the local day near UTC midnight", () => {
  const { todayInTimezone } = load("src/lib/utils/calendar-date.ts");
  assert.equal(todayInTimezone("America/New_York", new Date("2026-10-04T02:00:00Z")), "2026-10-03");
  assert.equal(todayInTimezone("Europe/Paris", new Date("2026-10-04T02:00:00Z")), "2026-10-04");
});

async function renderDashboard(studies, readError = null) {
  const exports = {};
  const file = "src/app/dashboard/page.tsx";
  const realRequire = createRequire(import.meta.url);
  const supabase = { from(table) {
    const output = table === "profiles" ? { data: { timezone: "America/New_York" }, error: readError }
      : { data: [{ id: "course", code: "INF", name: "Algorithmie", archived_at: null, exams: [] }], error: readError };
    return { select() { return this; }, eq() { return this; }, maybeSingle: async () => output, then(resolve) { return Promise.resolve(output).then(resolve); } };
  } };
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, Date, Intl, require(name) {
    if (name === "react/jsx-runtime") return realRequire(name);
    if (name === "next/link") return { default: (props) => React.createElement("a", props) };
    if (name === "@/lib/supabase/require-user") return { requireUser: async () => ({ supabase, userId: "owner" }) };
    if (name === "@/lib/supabase/load-study-sessions") return { loadStudySessions: async () => studies };
    return load(`src/${name.slice(2)}.ts`);
  } });
  return renderToStaticMarkup(await exports.default({ searchParams: Promise.resolve({}) }));
}
test("dashboard renders an actionable saved session, completed history and future sessions without completion forms", async () => {
  const { todayInTimezone } = load("src/lib/utils/calendar-date.ts");
  const today = todayInTimezone("America/New_York");
  const html = await renderDashboard([
    { ...study("current", today, "planned"), course_id: "course", start_time: "10:00", end_time: "11:30", revision_stage: 1 },
    { ...study("future", "2099-01-01", "planned"), course_id: "course", start_time: "10:00", end_time: "11:30", revision_stage: 2 },
    { ...study("done", "2020-01-01", "completed", 90, "2020-01-01T16:00:00Z"), course_id: "course", start_time: "10:00", end_time: "11:30", revision_stage: 1 },
  ]);
  assert.equal((html.match(/action="\/dashboard\/complete"/g) ?? []).length, 1);
  assert.match(html, /name="id" value="current"/);
  assert.doesNotMatch(html, /name="id" value="future"/);
  assert.match(html, /✓ Terminée/); assert.match(html, /Algorithmie/);
});
test("a dashboard read failure is reported rather than displaying zero workload", async () => {
  await assert.rejects(renderDashboard([], { code: "offline" }), /Impossible de charger/);
});
