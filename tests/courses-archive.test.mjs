import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const userId = "11111111-1111-1111-1111-111111111111";
const courseId = "22222222-2222-2222-2222-222222222222";
const sessionId = "33333333-3333-3333-3333-333333333333";
class NextResponse extends Response {
  static redirect(destination, status) {
    return new NextResponse(null, { status, headers: { Location: String(destination) } });
  }
}
function load(file, supabase) {
  const absolute = path.resolve(file);
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(absolute, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, URL, require(name) {
    if (name === "next/server") return { NextResponse };
    if (name === "@/lib/supabase/require-user") return { requireUser: async () => ({ supabase, userId }) };
    return load(name.startsWith("@/") ? `src/${name.slice(2)}.ts` : path.resolve(path.dirname(absolute), `${name}.ts`), supabase);
  } });
  return exports;
}
function request(route, fields, origin = "http://localhost:3000") {
  const value = new Request(`http://localhost:3000${route}`, { method: "POST", headers: { origin }, body: new URLSearchParams(fields) });
  value.nextUrl = new URL(value.url);
  return value;
}
function result(response) { return new URL(response.headers.get("Location")).searchParams.get("result"); }

test("archiving invokes the authenticated RPC without a submitted owner or hard delete", async () => {
  const calls = [];
  const supabase = { rpc: async (...args) => { calls.push(args); return { data: true, error: null }; }, from: () => { throw new Error("Hard delete must not be used"); } };
  const { POST } = load("src/app/courses/delete/route.ts", supabase);
  const response = await POST(request("/courses/delete", { id: courseId, user_id: "attacker" }));
  assert.equal(response.status, 303);
  assert.equal(result(response), "archived");
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "archive_course");
  assert.equal(JSON.stringify(calls[0][1]), JSON.stringify({ p_course_id: courseId }));
});
test("archiving rejects an external origin and invalid course identity before writing", async () => {
  let writes = 0;
  const { POST } = load("src/app/courses/delete/route.ts", { rpc: async () => { writes++; return { data: true }; } });
  assert.equal((await POST(request("/courses/delete", { id: courseId }, "https://external.example"))).status, 403);
  assert.equal(result(await POST(request("/courses/delete", { id: "invalid" }))), "invalid");
  assert.equal(writes, 0);
});
test("missing archival migration and unavailable owned course have distinct results", async () => {
  let output = { data: false, error: null };
  const { POST } = load("src/app/courses/delete/route.ts", { rpc: async () => output });
  assert.equal(result(await POST(request("/courses/delete", { id: courseId }))), "missing");
  output = { data: null, error: { code: "PGRST202" } };
  assert.equal(result(await POST(request("/courses/delete", { id: courseId }))), "migration");
});
function unavailableCourses() {
  const filters = [];
  const query = {
    select() { return this; },
    eq(...args) { filters.push(["eq", ...args]); return this; },
    is(...args) { filters.push(["is", ...args]); return this; },
    maybeSingle: async () => ({ data: null, error: null }),
    then(resolve) { return Promise.resolve({ data: [], error: null }).then(resolve); },
  };
  return { filters, supabase: { from(table) { assert.equal(table, "courses", "Unavailable courses must not allow child writes"); return query; } } };
}
test("an archived or unavailable course cannot have its weekly hours edited or deleted", async () => {
  for (const [route, file, fields] of [
    ["/courses/sessions/save", "src/app/courses/sessions/save/route.ts", { course_id: courseId, id: sessionId, day_of_week: "1", start_time: "18:00", end_time: "21:00" }],
    ["/courses/sessions/delete", "src/app/courses/sessions/delete/route.ts", { course_id: courseId, id: sessionId }],
  ]) {
    const { filters, supabase } = unavailableCourses();
    const { POST } = load(file, supabase);
    assert.equal(result(await POST(request(route, fields))), "missing");
    assert.ok(filters.some((f) => f[0] === "eq" && f[1] === "user_id" && f[2] === userId));
    assert.ok(filters.some((f) => f[0] === "is" && f[1] === "archived_at" && f[2] === null));
  }
});
test("an archived or unavailable course cannot receive or delete an exam", async () => {
  for (const fields of [
    { action: "save", course_id: courseId, title: "Exam", exam_date: "2026-11-02", start_time: "10:00", end_time: "12:00", importance: "2" },
    { action: "delete", id: sessionId },
  ]) {
    const { filters, supabase } = unavailableCourses();
    const { POST } = load("src/app/exams/manage/route.ts", supabase);
    assert.equal(result(await POST(request("/exams/manage", fields))), "missing");
    assert.ok(filters.some((f) => f[0] === "eq" && f[1] === "user_id" && f[2] === userId));
    assert.ok(filters.some((f) => f[0] === "is" && f[1] === "archived_at" && f[2] === null));
  }
});
test("course editing scopes the write to an active course owned by the signed-in user", async () => {
  const filters = [];
  const query = { eq(...args) { filters.push(["eq", ...args]); return this; }, is(...args) { filters.push(["is", ...args]); return this; }, select() { return this; }, maybeSingle: async () => ({ data: null, error: null }) };
  const { POST } = load("src/app/courses/save/route.ts", { from: () => ({ update: () => query }) });
  assert.equal(result(await POST(request("/courses/save", { id: courseId, code: "INF", name: "Info", color: "#123456", revision_multiplier: "2", user_id: "attacker" }))), "missing");
  assert.ok(filters.some((f) => f[0] === "eq" && f[1] === "user_id" && f[2] === userId));
  assert.ok(filters.some((f) => f[0] === "is" && f[1] === "archived_at" && f[2] === null));
});
