import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

class NextResponse extends Response {
  static redirect(url, status) { return new NextResponse(null, { status, headers: { Location: String(url) } }); }
}
function load(file, mocks, env = {}) {
  const exports = {};
  const absolute = path.resolve(file);
  const code = ts.transpileModule(fs.readFileSync(absolute, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { process: { env }, exports, URL, Date, Intl, require(name) {
    if (name in mocks) return mocks[name];
    if (name === "next/server") return { NextResponse };
    return load(name.startsWith("@/") ? `src/${name.slice(2)}.ts` : path.resolve(path.dirname(absolute), `${name}.ts`), mocks, env);
  } });
  return exports;
}
function request(url, origin) {
  const headers = origin == null ? {} : { origin };
  const value = new Request(url, { method: "POST", headers, body: new URLSearchParams({ user_id: "foreign-owner", id: "foreign-id" }) });
  value.nextUrl = new URL(url);
  return value;
}
const routes = ["courses/save", "courses/delete", "courses/sessions/save", "courses/sessions/delete", "exams/manage", "availability/manage", "settings/revision/save", "calendar/save", "dashboard/complete", "dashboard/missed", "auth/login"];
test("configured public origin accepts HTTPS tunnel forms, keeps redirects public and rejects other origins", async () => {
  const env = { APP_PUBLIC_ORIGIN: "https://study-test.ngrok-free.app" };
  const mocks = { "@/lib/supabase/require-user": { requireUser: async () => { throw new Error("authentication reached"); } } };
  for (const route of routes.filter((route) => route !== "auth/login")) {
    const { POST } = load(`src/app/${route}/route.ts`, mocks, env);
    const internal = `http://127.0.0.1:3001/${route}`;
    await assert.rejects(POST(request(internal, env.APP_PUBLIC_ORIGIN)), /authentication reached/);
    assert.equal((await POST(request(internal, "https://foreign.example"))).status, 403);
    assert.equal((await POST(request(internal, "http://127.0.0.1:3001"))).status, 403);
  }
  const { POST } = load("src/app/auth/login/route.ts", {
    "@supabase/ssr": { createServerClient: () => { throw new Error("empty form must not contact auth"); } },
    "@/lib/supabase/config": { getSupabaseConfig: () => { throw new Error("empty form must not load config"); } },
  }, env);
  const response = await POST(request("http://127.0.0.1:3001/auth/login", env.APP_PUBLIC_ORIGIN));
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("Location"), "https://study-test.ngrok-free.app/login?error=required");
});
test("public origin cannot be chosen through forwarding headers; malformed server configuration fails closed", () => {
  const { hasSameOrigin, requestOrigin } = load("src/lib/http/request-origin.ts", {});
  const forged = request("http://localhost:3000/courses/save", "https://foreign.example");
  forged.headers.set("x-forwarded-host", "foreign.example"); forged.headers.set("x-forwarded-proto", "https");
  assert.equal(hasSameOrigin(forged), false); assert.equal(requestOrigin(forged), "http://localhost:3000");
  for (const origin of ["https://user:password@example.com", "https://example.com/path", "https://example.com?query=1", "file:///local", "invalid"]) {
    const helper = load("src/lib/http/request-origin.ts", {}, { APP_PUBLIC_ORIGIN: origin });
    assert.throws(() => helper.requestOrigin(forged));
  }
});
test("every POST endpoint rejects foreign, missing and null origins before authentication or database access", async () => {
  let accesses = 0;
  const mocks = {
    "@/lib/supabase/require-user": { requireUser: async () => { accesses++; throw new Error("unexpected authentication"); } },
    "@supabase/ssr": { createServerClient: () => { accesses++; throw new Error("unexpected client"); } },
    "@/lib/supabase/config": { getSupabaseConfig: () => { accesses++; throw new Error("unexpected configuration"); } },
  };
  for (const route of routes) {
    const { POST } = load(`src/app/${route}/route.ts`, mocks);
    for (const origin of ["https://foreign.example", undefined, "null", "http://localhost:3000.attacker.example"]) {
      const response = await POST(request(`http://localhost:3000/${route}`, origin));
      assert.equal(response.status, 403, `${route} / ${origin}`);
    }
  }
  assert.equal(accesses, 0);
});
test("every private mutation requires authentication before parsing submitted data or writing", async () => {
  for (const route of routes.filter((route) => route !== "auth/login")) {
    let formReads = 0;
    const { POST } = load(`src/app/${route}/route.ts`, {
      "@/lib/supabase/require-user": { requireUser: async () => { throw new Error("redirect:/login"); } },
    });
    const value = request(`http://localhost:3000/${route}`, "http://localhost:3000");
    value.formData = async () => { formReads++; return new FormData(); };
    await assert.rejects(POST(value), /redirect:\/login/);
    assert.equal(formReads, 0, route);
  }
});
test("requireUser uses verified claims, redirects invalid sessions and ignores unverified cookie session data", async () => {
  for (const output of [{ error: new Error("invalid token"), data: { claims: { sub: "forged" } } }, { data: null }, { data: { claims: {} } }]) {
    const { requireUser } = load("src/lib/supabase/require-user.ts", {
      react: { cache: (fn) => fn },
      "next/navigation": { redirect: (url) => { throw new Error(`redirect:${url}`); } },
      "./server": { createClient: async () => ({ auth: { getClaims: async () => output, getSession: () => { throw new Error("unverified session used"); } } }) },
    });
    await assert.rejects(requireUser(), /redirect:\/login/);
  }
  const supabase = { auth: { getClaims: async () => ({ data: { claims: { sub: "verified-owner" } }, error: null }) } };
  const { requireUser } = load("src/lib/supabase/require-user.ts", {
    react: { cache: (fn) => fn }, "next/navigation": { redirect: () => { throw new Error("unexpected redirect"); } },
    "./server": { createClient: async () => supabase },
  });
  const result = await requireUser(); assert.equal(result.userId, "verified-owner"); assert.equal(result.supabase, supabase);
});
