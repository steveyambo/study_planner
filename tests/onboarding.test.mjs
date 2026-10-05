import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import { createRequire } from "node:module";
import { renderToStaticMarkup } from "react-dom/server";

const accountId = "authenticated-account";
const plain = (value) => JSON.parse(JSON.stringify(value));
const realRequire = createRequire(import.meta.url);

// Every runtime dependency is explicit: these tests never initialize the real
// require-user module or require Supabase credentials.
function load(file, dependencies = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, {
    exports, Date, Intl, Map, Event, ...globals,
    require(name) {
      if (Object.hasOwn(dependencies, name)) return dependencies[name];
      if (name === "@/lib/supabase/require-user") throw new Error("require-user must be mocked");
      if (name.startsWith("@/") || name.startsWith(".")) {
        const target = name.startsWith("@/") ? `src/${name.slice(2)}` : path.resolve(path.dirname(file), name);
        return load(fs.existsSync(`${target}.tsx`) ? `${target}.tsx` : `${target}.ts`, dependencies, globals);
      }
      throw new Error(`Unmocked dependency: ${name}`);
    },
  });
  return exports;
}

const { getNextSetupStep, setupStepIsComplete } = load("src/lib/onboarding/setup-progress.ts");
const { DEFAULT_SETUP_PREFERENCES, parseSetupPreferences, setupPreferencesKey } = load("src/lib/onboarding/setup-preferences.ts");
const emptyProgress = {
  courseCount: 0, coursesWithoutHours: [], weeklySessionCount: 0,
  availabilityCount: 0, weeklyAvailableMinutes: 0, upcomingExamCount: 0,
  hasSavedPlanning: false, planningIsCurrent: false, plannedSessionCount: 0,
};
const configuredProgress = {
  ...emptyProgress, courseCount: 2, weeklySessionCount: 3,
  availabilityCount: 1, weeklyAvailableMinutes: 90,
};

test("the guide advances only after real courses, all weekly hours, availability, and a current saved planning", () => {
  let progress = { ...emptyProgress };
  assert.equal(getNextSetupStep(progress, false), "courses");
  assert.equal(setupStepIsComplete(progress, "hours", false), false, "an empty missing-hours list does not validate an account without courses");
  progress = { ...progress, courseCount: 2, weeklySessionCount: 1, coursesWithoutHours: [{ id: "b", code: "ANG", name: "Anglais" }] };
  assert.equal(getNextSetupStep(progress, false), "hours");
  progress = { ...progress, coursesWithoutHours: [], weeklySessionCount: 3 };
  assert.equal(getNextSetupStep(progress, false), "availability");
  progress = { ...progress, availabilityCount: 1, weeklyAvailableMinutes: 90 };
  assert.equal(getNextSetupStep(progress, false), "exams");
  assert.equal(getNextSetupStep(progress, true), "planning", "acknowledging unknown exam dates skips only the optional exam review");
  progress = { ...progress, hasSavedPlanning: true, planningIsCurrent: false };
  assert.equal(getNextSetupStep(progress, true), "planning");
  progress = { ...progress, planningIsCurrent: true };
  assert.equal(getNextSetupStep(progress, true), "complete");
  assert.equal(setupStepIsComplete(progress, "complete", true), true);
});

test("local guide preferences cannot validate missing data or an unsaved or stale schedule", () => {
  const preferences = parseSetupPreferences(JSON.stringify({ started: true, paused: true, examsReviewed: true, welcomeDismissed: true, completed: true }));
  assert.equal(getNextSetupStep(emptyProgress, preferences.examsReviewed), "courses");
  assert.equal(setupStepIsComplete(emptyProgress, "complete", preferences.examsReviewed), false);
  assert.equal(getNextSetupStep(configuredProgress, preferences.examsReviewed), "planning");
  assert.equal(setupStepIsComplete({ ...configuredProgress, hasSavedPlanning: false, planningIsCurrent: true }, "planning", true), false);
  assert.equal(setupStepIsComplete({ ...configuredProgress, hasSavedPlanning: true, planningIsCurrent: false, plannedSessionCount: 12 }, "complete", true), false);
});

test("upcoming exams or an already saved planning skip the optional exam review", () => {
  assert.equal(getNextSetupStep({ ...configuredProgress, upcomingExamCount: 1 }, false), "planning");
  assert.equal(getNextSetupStep({ ...configuredProgress, hasSavedPlanning: true }, false), "planning");
  assert.equal(getNextSetupStep({ ...configuredProgress, hasSavedPlanning: true, planningIsCurrent: true, plannedSessionCount: 0 }, false), "complete");
  assert.equal(setupStepIsComplete(configuredProgress, "exams", false), false);
});

test("preference parsing recovers from corrupt JSON and requires actual boolean values", () => {
  for (const value of [null, "", "{broken", "null", "true", "0", '"text"', "[]"]) {
    assert.deepEqual(plain(parseSetupPreferences(value)), plain(DEFAULT_SETUP_PREFERENCES));
  }
  assert.deepEqual(plain(parseSetupPreferences(JSON.stringify({ started: "true", paused: 1, examsReviewed: [], welcomeDismissed: {} }))), plain(DEFAULT_SETUP_PREFERENCES));
  assert.deepEqual(plain(parseSetupPreferences('{"started":true,"paused":false,"examsReviewed":true,"ignored":true}')), {
    started: true, paused: false, examsReviewed: true, welcomeDismissed: false,
  });
});

test("guide preferences use distinct versioned storage keys for each account", () => {
  assert.equal(setupPreferencesKey(accountId), "study-planner:guided-setup:v1:authenticated-account");
  assert.notEqual(setupPreferencesKey("account-a"), setupPreferencesKey("account-b"));
});

const course = (id, options = {}) => ({
  id, code: `CODE-${id}`, name: `Course ${id}`, archived_at: null,
  course_sessions: [{ id: `hours-${id}` }], exams: [], ...options,
});
const slot = (id, start_time = "10:00:00", end_time = "11:30:00") => ({ id, start_time, end_time });
class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : ["2026-10-05T00:30:00Z"])); }
}

function loaderHarness(options = {}) {
  const queries = [];
  const rows = { courses: options.courses ?? [course("a")], availabilities: options.availabilities ?? [slot("a")] };
  const profile = Object.hasOwn(options, "profile") ? options.profile : {
    full_name: "Alex Exemple", timezone: "America/New_York", planning_revision: 7, saved_planning_revision: null,
  };
  const supabase = {
    from(table) {
      const record = { table, filters: [], orders: [], range: null };
      queries.push(record);
      const query = {
        select(columns, selectOptions) { record.columns = columns; record.selectOptions = selectOptions; return query; },
        eq(column, value) { record.filters.push({ column, value }); return query; },
        order(column) { record.orders.push(column); return query; },
        range(from, to) { record.range = { from, to }; return query; },
        async maybeSingle() { return { data: profile, error: options.profileError ?? null }; },
        then(resolve, reject) {
          let response;
          if (table === "study_sessions") {
            response = { data: null, count: Object.hasOwn(options, "plannedCount") ? options.plannedCount : 0, error: options.plannedError ?? null };
          } else {
            assert.ok(record.range, "list reads are explicitly paginated");
            const { from, to } = record.range;
            const error = options.pageErrors?.[`${table}:${from}`];
            response = error ? { data: null, error } : {
              data: options.nullPages?.includes(`${table}:${from}`) ? null : rows[table].slice(from, Math.min(to + 1, from + (options.pageLimit ?? 1000))),
              error: null,
            };
          }
          return Promise.resolve(response).then(resolve, reject);
        },
      };
      return query;
    },
  };
  let authenticationReads = 0;
  const loaded = load("src/lib/onboarding/load-setup-progress.ts", {
    // Identity avoids creating a process-wide cache in a test. Production React
    // supplies the cache for one server-render request.
    react: { cache: (fn) => fn },
    "@/lib/supabase/require-user": { requireUser: async () => {
      authenticationReads++;
      if (options.authenticationError) throw options.authenticationError;
      return { supabase, userId: accountId };
    } },
  }, { Date: FixedDate });
  return { ...loaded, supabase, queries, authenticationReads: () => authenticationReads };
}

test("loader derives honest totals from active courses and valid availability durations", async () => {
  const app = loaderHarness({
    courses: [
      course("a", { course_sessions: [{ id: "a1" }, { id: "a2" }], exams: [{ exam_date: "2026-10-03" }, { exam_date: "2026-10-04" }, { exam_date: "2026-12-01" }] }),
      course("b", { course_sessions: [] }),
      course("archived", { archived_at: "2026-10-01", course_sessions: [{ id: "archived-hours" }], exams: [{ exam_date: "2099-01-01" }] }),
    ],
    availabilities: [slot("valid"), slot("reverse", "12:00", "11:00"), slot("invalid", "bad", "12:00")],
    plannedCount: 23,
  });
  const result = await app.fetchSetupProgress(app.supabase, accountId);
  assert.equal(result.fullName, "Alex Exemple");
  assert.deepEqual(plain(result.progress), {
    courseCount: 2, coursesWithoutHours: [{ id: "b", code: "CODE-b", name: "Course b" }],
    weeklySessionCount: 2, availabilityCount: 3, weeklyAvailableMinutes: 90,
    upcomingExamCount: 2, hasSavedPlanning: false, planningIsCurrent: false, plannedSessionCount: 23,
  });
  assert.equal(getNextSetupStep(result.progress, false), "hours");
});

test("every loader read is scoped to its authenticated account and planned count is exact", async () => {
  const app = loaderHarness({ courses: [course("a"), course("b")], pageLimit: 1 });
  const result = await app.loadSetupProgress();
  assert.equal(result.userId, accountId);
  assert.equal(app.authenticationReads(), 1);
  for (const query of app.queries) {
    assert.ok(query.filters.some(({ column, value }) => column === (query.table === "profiles" ? "id" : "user_id") && value === accountId), `${query.table} has the authenticated account filter`);
    if (query.table === "courses" || query.table === "availabilities") assert.deepEqual(query.orders, ["id"]);
  }
  const planned = app.queries.find(({ table }) => table === "study_sessions");
  assert.deepEqual(plain(planned.selectOptions), { count: "exact", head: true });
  assert.ok(planned.filters.some(({ column, value }) => column === "status" && value === "planned"));
});

test("the request loader delegates authentication before accessing profile or setup data", async () => {
  const redirect = new Error("unauthenticated redirect");
  const app = loaderHarness({ authenticationError: redirect });
  await assert.rejects(app.loadSetupProgress(), (error) => error === redirect);
  assert.equal(app.authenticationReads(), 1);
  assert.equal(app.queries.length, 0);
});

test("successful empty reads describe a genuinely new account without conflating it with errors", async () => {
  const app = loaderHarness({ courses: [], availabilities: [] });
  const { progress } = await app.fetchSetupProgress(app.supabase, accountId);
  assert.deepEqual(plain(progress), emptyProgress);
  assert.equal(getNextSetupStep(progress, false), "courses");
});

test("short pages continue until an empty page and retain missing hours from later pages", async () => {
  const app = loaderHarness({
    pageLimit: 2,
    courses: [course("a"), course("b"), course("c"), course("d"), course("e", { course_sessions: [] })],
    availabilities: [slot("a"), slot("b"), slot("c")],
  });
  const { progress } = await app.fetchSetupProgress(app.supabase, accountId);
  assert.equal(progress.courseCount, 5);
  assert.equal(progress.coursesWithoutHours[0].id, "e");
  assert.equal(progress.availabilityCount, 3);
  assert.equal(progress.weeklyAvailableMinutes, 270);
  assert.deepEqual(app.queries.filter(({ table }) => table === "courses").map(({ range }) => range.from), [0, 2, 4, 5]);
  assert.deepEqual(app.queries.filter(({ table }) => table === "availabilities").map(({ range }) => range.from), [0, 2, 3]);
});

test("courses and availability beyond the default 1000-row cap are included", async () => {
  const courses = Array.from({ length: 1101 }, (_, index) => course(String(index), index === 1100 ? { course_sessions: [] } : {}));
  const app = loaderHarness({ courses, availabilities: Array.from({ length: 1001 }, (_, index) => slot(String(index))) });
  const { progress } = await app.fetchSetupProgress(app.supabase, accountId);
  assert.equal(progress.courseCount, 1101);
  assert.equal(progress.weeklySessionCount, 1100);
  assert.equal(progress.coursesWithoutHours[0].id, "1100");
  assert.equal(progress.availabilityCount, 1001);
  assert.deepEqual(app.queries.filter(({ table }) => table === "courses").map(({ range }) => range.from), [0, 1000, 1101]);
  assert.deepEqual(app.queries.filter(({ table }) => table === "availabilities").map(({ range }) => range.from), [0, 1000, 1001]);
});

test("profile errors or a missing profile reject instead of presenting a new empty account", async () => {
  for (const options of [{ profileError: { message: "profile read failed" } }, { profile: null }]) {
    const app = loaderHarness(options);
    await assert.rejects(app.fetchSetupProgress(app.supabase, accountId), /Impossible de vérifier/);
  }
});

test("failed or null list pages reject instead of validating partial course or availability data", async () => {
  for (const table of ["courses", "availabilities"]) {
    for (const options of [{ pageErrors: { [`${table}:0`]: { message: "first page failed" } } }, { nullPages: [`${table}:0`] }, { pageErrors: { [`${table}:2`]: { message: "later page failed" } } }, { nullPages: [`${table}:2`] }]) {
      const app = loaderHarness({
        courses: [course("a"), course("b"), course("c")],
        availabilities: [slot("a"), slot("b"), slot("c")], pageLimit: 2, ...options,
      });
      await assert.rejects(app.fetchSetupProgress(app.supabase, accountId), /Impossible de vérifier/);
    }
  }
});

test("an unavailable exact planned-session count rejects instead of reporting zero sessions", async () => {
  for (const options of [{ plannedError: { message: "count failed" } }, { plannedCount: null }]) {
    const app = loaderHarness(options);
    await assert.rejects(app.fetchSetupProgress(app.supabase, accountId), /Impossible de vérifier/);
  }
});

test("an account with only archived courses still needs to add an active course", async () => {
  const app = loaderHarness({ courses: [course("archived", { archived_at: "2026-10-01", course_sessions: [], exams: [{ exam_date: "2099-01-01" }] })] });
  const { progress } = await app.fetchSetupProgress(app.supabase, accountId);
  assert.equal(progress.courseCount, 0);
  assert.equal(progress.coursesWithoutHours.length, 0);
  assert.equal(progress.weeklySessionCount, 0);
  assert.equal(progress.upcomingExamCount, 0);
  assert.equal(getNextSetupStep(progress, true), "courses");
});

test("upcoming exams include today in the profile timezone at a UTC date boundary", async () => {
  for (const [timezone, expected] of [["America/New_York", 2], ["Pacific/Kiritimati", 1], [null, 2]]) {
    const app = loaderHarness({
      profile: { full_name: null, timezone, planning_revision: 7, saved_planning_revision: null },
      courses: [course("a", { exams: [{ exam_date: "2026-10-03" }, { exam_date: "2026-10-04" }, { exam_date: "2026-10-05" }] })],
    });
    const result = await app.fetchSetupProgress(app.supabase, accountId);
    assert.equal(result.progress.upcomingExamCount, expected, `exam boundary for ${timezone}`);
    assert.equal(result.fullName, "");
  }
});

test("revision zero is a valid saved planning even when no planned rows remain", async () => {
  for (const savedRevision of [0, "0"]) {
    const app = loaderHarness({ profile: { timezone: "America/New_York", planning_revision: 0, saved_planning_revision: savedRevision }, plannedCount: 0 });
    const { progress } = await app.fetchSetupProgress(app.supabase, accountId);
    assert.equal(progress.hasSavedPlanning, true);
    assert.equal(progress.planningIsCurrent, true);
    assert.equal(progress.plannedSessionCount, 0);
    assert.equal(getNextSetupStep(progress, false), "complete");
  }
});

test("missing or stale revisions cannot claim the first planning is complete", async () => {
  for (const [revision, saved, hasSaved] of [[7, null, false], [8, 7, true], [null, 7, true]]) {
    const app = loaderHarness({ profile: { timezone: "America/New_York", planning_revision: revision, saved_planning_revision: saved }, plannedCount: 10 });
    const { progress } = await app.fetchSetupProgress(app.supabase, accountId);
    assert.equal(progress.hasSavedPlanning, hasSaved);
    assert.equal(progress.planningIsCurrent, false);
    assert.equal(getNextSetupStep(progress, true), "planning");
  }
});

function preferenceHarness({ blockedStorage = false, blockedWrites = false } = {}) {
  const storage = new Map();
  const listeners = new Map();
  let subscription;
  const window = {
    localStorage: {
      getItem(key) { if (blockedStorage) throw new Error("storage unavailable"); return storage.get(key) ?? null; },
      setItem(key, value) { if (blockedStorage || blockedWrites) throw new Error("storage unavailable"); storage.set(key, value); },
    },
    addEventListener(type, listener) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(listener); },
    removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
    dispatchEvent(event) { for (const listener of listeners.get(event.type) ?? []) listener(event); return true; },
  };
  const { useSetupPreferences } = load("src/lib/onboarding/use-setup-preferences.ts", {
    react: { useCallback: (fn) => fn, useMemo: (fn) => fn(), useSyncExternalStore: (subscribe, snapshot) => { subscription = subscribe; return snapshot(); } },
  }, { window });
  return { useSetupPreferences, storage, window, subscribe: (listener) => subscription(listener) };
}

test("preference updates retain other fields and do not leak guide state to another account", () => {
  const app = preferenceHarness();
  app.useSetupPreferences("a").updatePreferences({ started: true });
  app.useSetupPreferences("a").updatePreferences({ paused: true, examsReviewed: true });
  assert.deepEqual(plain(app.useSetupPreferences("a").preferences), { started: true, paused: true, examsReviewed: true, welcomeDismissed: false });
  assert.deepEqual(plain(app.useSetupPreferences("b").preferences), plain(DEFAULT_SETUP_PREFERENCES));
  assert.ok(app.storage.has(setupPreferencesKey("a")));
  assert.equal(app.storage.has(setupPreferencesKey("b")), false);
});

test("guide preferences remain usable within this session when browser storage is blocked", () => {
  const app = preferenceHarness({ blockedStorage: true });
  app.useSetupPreferences("a").updatePreferences({ started: true, examsReviewed: true });
  assert.equal(app.useSetupPreferences("a").preferences.started, true);
  assert.equal(app.useSetupPreferences("a").preferences.examsReviewed, true);
  assert.equal(app.useSetupPreferences("b").preferences.started, false);
});

test("a failed storage write overrides the old readable value for the active session", () => {
  const app = preferenceHarness({ blockedWrites: true });
  app.storage.set(setupPreferencesKey("a"), JSON.stringify({ started: true, paused: false }));
  app.useSetupPreferences("a").updatePreferences({ paused: true, examsReviewed: true });
  assert.equal(app.useSetupPreferences("a").preferences.started, true);
  assert.equal(app.useSetupPreferences("a").preferences.paused, true);
  assert.equal(app.useSetupPreferences("a").preferences.examsReviewed, true);
  assert.equal(JSON.parse(app.storage.get(setupPreferencesKey("a"))).paused, false);
});

test("cross-tab storage updates replace session overrides and clearing storage resets preferences", () => {
  const app = preferenceHarness();
  app.useSetupPreferences("a").updatePreferences({ started: true, paused: true });
  app.useSetupPreferences("a");
  const unsubscribe = app.subscribe(() => {});
  app.storage.set(setupPreferencesKey("a"), JSON.stringify({ started: true, paused: false, examsReviewed: true }));
  app.window.dispatchEvent({ type: "storage", key: setupPreferencesKey("a") });
  assert.equal(app.useSetupPreferences("a").preferences.paused, false);
  assert.equal(app.useSetupPreferences("a").preferences.examsReviewed, true);
  app.storage.clear();
  app.window.dispatchEvent({ type: "storage", key: null });
  assert.deepEqual(plain(app.useSetupPreferences("a").preferences), plain(DEFAULT_SETUP_PREFERENCES));
  unsubscribe();
});

test("preference subscriptions react to the account key and clear events and clean up listeners", () => {
  const app = preferenceHarness();
  app.useSetupPreferences("a");
  let notifications = 0;
  const unsubscribe = app.subscribe(() => notifications++);
  app.window.dispatchEvent({ type: "storage", key: setupPreferencesKey("b") });
  assert.equal(notifications, 0);
  app.window.dispatchEvent({ type: "storage", key: setupPreferencesKey("a") });
  app.window.dispatchEvent({ type: "storage", key: null });
  app.useSetupPreferences("a").updatePreferences({ paused: true });
  assert.equal(notifications, 3);
  unsubscribe();
  app.window.dispatchEvent({ type: "storage", key: setupPreferencesKey("a") });
  app.useSetupPreferences("a").updatePreferences({ paused: false });
  assert.equal(notifications, 3);
});

function guideHarness({ progress = emptyProgress, preferences = DEFAULT_SETUP_PREFERENCES } = {}) {
  const state = [];
  let index = 0;
  let currentProgress = progress;
  let currentPreferences = { ...preferences };
  const updates = [];
  const react = {
    ...React,
    useState(initial) {
      const position = index++;
      if (!(position in state)) state[position] = typeof initial === "function" ? initial() : initial;
      return [state[position], (next) => { state[position] = typeof next === "function" ? next(state[position]) : next; }];
    },
    useRef(initial) {
      const position = index++;
      if (!(position in state)) state[position] = { current: initial };
      return state[position];
    },
    useEffect() {},
  };
  const dependencies = {
    react,
    "react/jsx-runtime": realRequire("react/jsx-runtime"),
    "next/link": { default: ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children) },
    "lucide-react": realRequire("lucide-react"),
    "@radix-ui/react-slot": realRequire("@radix-ui/react-slot"),
    "class-variance-authority": realRequire("class-variance-authority"),
    clsx: realRequire("clsx"),
    "tailwind-merge": realRequire("tailwind-merge"),
    "@/lib/onboarding/use-setup-preferences": {
      useSetupPreferences(userId) {
        assert.equal(userId, accountId);
        return { preferences: currentPreferences, updatePreferences(patch) { updates.push(plain(patch)); currentPreferences = { ...currentPreferences, ...patch }; } };
      },
    },
  };
  const { SetupGuide } = load("src/components/onboarding/setup-guide.tsx", dependencies);
  const { SetupNudge } = load("src/components/onboarding/setup-nudge.tsx", dependencies);
  const render = () => { index = 0; return SetupGuide({ progress: currentProgress, userId: accountId }); };
  const nodes = (node) => node && typeof node === "object" ? [node, ...React.Children.toArray(node.props?.children).flatMap(nodes)] : [];
  const text = (node) => typeof node === "string" || typeof node === "number" ? String(node) : React.Children.toArray(node?.props?.children).map(text).join("");
  return {
    render, updates,
    html: () => renderToStaticMarkup(render()),
    setProgress: (next) => { currentProgress = next; },
    nudge: (page) => renderToStaticMarkup(SetupNudge({ progress: currentProgress, userId: accountId, page })),
    clickNudge(page, label) {
      const button = nodes(SetupNudge({ progress: currentProgress, userId: accountId, page })).find((node) => typeof node.props?.onClick === "function" && text(node) === label);
      assert.ok(button, "nudge control exists");
      button.props.onClick();
    },
    click(predicate) {
      const button = nodes(render()).find((node) => typeof node.props?.onClick === "function" && predicate(node.props, text(node)));
      assert.ok(button, "interactive control exists");
      assert.notEqual(button.props.disabled, true, "interactive control is enabled");
      button.props.onClick();
    },
    progressButtons: () => nodes(render()).filter((node) => node.type === "button" && node.props["aria-label"]?.startsWith("Étape ")),
  };
}

test("the real guide introduction has named progress and step regions with five disabled future steps", () => {
  const app = guideHarness();
  const html = app.html();
  assert.match(html, /<h1 id="setup-step-title"[^>]*>De tes cours à tes prochaines révisions<\/h1>/);
  assert.match(html, /<section aria-labelledby="setup-step-title"/);
  assert.match(html, /<progress[^>]*value="0"[^>]*max="5"[^>]*aria-label="Étapes de configuration complétées"/);
  assert.match(html, /Un exemple concret/);
  assert.equal(app.progressButtons().length, 5);
  assert.ok(app.progressButtons().every((button) => button.props.disabled));
  app.click((_props, label) => label === "Commencer avec mes cours");
  assert.match(app.html(), /Commence par tes matières/);
  assert.match(app.html(), /0 sur 5 étapes complétées/);
  assert.match(app.html(), /aria-current="step" aria-label="Étape 1 : Cours, à compléter"/);
  assert.deepEqual(app.updates, [{ started: true, paused: false }]);
});

test("guide navigation does not validate missing course hours or enable later steps", () => {
  const progress = { ...configuredProgress, coursesWithoutHours: [{ id: "missing", code: "BIO", name: "Biologie" }] };
  const app = guideHarness({ progress, preferences: { ...DEFAULT_SETUP_PREFERENCES, started: true } });
  assert.match(app.html(), /Quand as-tu cours/);
  assert.match(app.html(), /href="\/courses#course-missing"/);
  assert.match(app.html(), /matière attend encore un horaire/);
  const planning = app.progressButtons().find((button) => button.props["aria-label"].includes("Planning"));
  assert.equal(planning.props.disabled, true);
  app.click((_props, label) => label === "Étape précédente");
  assert.match(app.html(), /Commence par tes matières/);
  app.click((_props, label) => label === "Continuer");
  assert.match(app.html(), /Quand as-tu cours/);
  assert.equal(app.updates.length, 0, "reviewing completed steps changes navigation only");
  assert.doesNotMatch(app.html(), /Ta configuration est enregistrée/);
});

test("acknowledging an unknown exam date reaches the unsaved planning step without claiming completion", () => {
  const app = guideHarness({ progress: configuredProgress, preferences: { ...DEFAULT_SETUP_PREFERENCES, started: true } });
  assert.match(app.html(), /As-tu une date d’examen/);
  app.click((_props, label) => label === "Je n’ai pas encore de date");
  const html = app.html();
  assert.match(html, /Enregistre ton premier planning/);
  assert.match(html, /Un aperçu seul ne sauvegarde aucun créneau/);
  assert.match(html, /4 sur 5 étapes complétées/);
  assert.doesNotMatch(html, /Ta configuration est enregistrée/);
  assert.deepEqual(app.updates, [{ examsReviewed: true }]);
});

test("returning after real saved data recommends the next step instead of retaining a stale review selection", () => {
  const app = guideHarness({ progress: { ...emptyProgress, courseCount: 1, coursesWithoutHours: [{ id: "a", code: "BIO", name: "Biologie" }] }, preferences: { ...DEFAULT_SETUP_PREFERENCES, started: true } });
  app.click((_props, label) => label === "Étape précédente");
  assert.match(app.html(), /Commence par tes matières/);
  app.setProgress({ ...configuredProgress, upcomingExamCount: 1 });
  assert.match(app.html(), /Enregistre ton premier planning/);
  assert.match(app.html(), /4 sur 5 étapes complétées/);
});

test("leaving and resuming the guide retains truthful progress and recommends the missing step", () => {
  const app = guideHarness({ progress: configuredProgress, preferences: { ...DEFAULT_SETUP_PREFERENCES, started: true } });
  app.click((_props, label) => label === "Quitter et reprendre plus tard");
  assert.match(app.html(), /Reprends à ton rythme/);
  assert.ok(app.progressButtons().every((button) => button.props.disabled));
  app.click((_props, label) => label === "Reprendre le guide");
  assert.match(app.html(), /As-tu une date d’examen/);
  assert.equal(app.updates[0].paused, true);
  assert.equal(app.updates[0].welcomeDismissed, true);
  assert.equal(app.updates[1].paused, false);
});

test("saved empty planning completion states zero sessions truthfully and points to planning review", () => {
  const app = guideHarness({ progress: { ...configuredProgress, hasSavedPlanning: true, planningIsCurrent: true, plannedSessionCount: 0 }, preferences: { ...DEFAULT_SETUP_PREFERENCES, started: true } });
  const html = app.html();
  assert.match(html, /Ta configuration est enregistrée/);
  assert.match(html, /aucune révision n’est actuellement planifiée/);
  assert.match(html, /href="\/calendar#replanning"[^>]*>Vérifier mon planning/);
  assert.match(html, /5 sur 5 étapes complétées/);
  assert.doesNotMatch(html, /[1-9]\d* révisions? (?:est|sont) planifiée/);
});

test("a stale saved planning renders the update action and remains incomplete", () => {
  const app = guideHarness({ progress: { ...configuredProgress, hasSavedPlanning: true, planningIsCurrent: false, plannedSessionCount: 5 }, preferences: { ...DEFAULT_SETUP_PREFERENCES, started: true } });
  const html = app.html();
  assert.match(html, /Mets ton planning à jour/);
  assert.match(html, /Mettre mon planning à jour/);
  assert.match(html, /4 sur 5 étapes complétées/);
  assert.doesNotMatch(html, /Ta configuration est enregistrée/);
});

test("the dashboard welcome is dismissible and an active guide nudge uses actual progress", () => {
  const welcome = guideHarness();
  assert.match(welcome.nudge("dashboard"), /aria-labelledby="setup-welcome-title"/);
  assert.match(welcome.nudge("dashboard"), /Bienvenue dans Study Planner/);
  assert.equal(welcome.nudge("guide"), "");
  assert.equal(welcome.nudge("settings"), "");
  welcome.clickNudge("dashboard", "Plus tard");
  assert.equal(welcome.nudge("dashboard"), "");
  assert.equal(welcome.updates[0].welcomeDismissed, true);
  const progress = { ...configuredProgress, coursesWithoutHours: [{ id: "missing", code: "BIO", name: "Biologie" }] };
  const active = guideHarness({ progress, preferences: { ...DEFAULT_SETUP_PREFERENCES, started: true } });
  const html = active.nudge("courses");
  assert.match(html, /href="\/courses#course-missing"/);
  assert.match(html, /À compléter : <\/span>Horaires : 1\/2 cours/);
  assert.match(html, /À compléter : <\/span>Planning : à enregistrer/);
  active.clickNudge("courses", "Mettre en pause");
  assert.equal(active.nudge("courses"), "");
  const complete = guideHarness({ progress: { ...configuredProgress, hasSavedPlanning: true, planningIsCurrent: true }, preferences: { ...DEFAULT_SETUP_PREFERENCES, started: true } });
  assert.equal(complete.nudge("dashboard"), "");
  const existing = guideHarness({ progress: { ...configuredProgress, hasSavedPlanning: true, planningIsCurrent: false } });
  assert.equal(existing.nudge("dashboard"), "", "existing saved planning suppresses the new-user welcome even before starting the guide");
});
