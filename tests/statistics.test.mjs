import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { createRequire } from "node:module";
import { renderToStaticMarkup } from "react-dom/server";
const realRequire = createRequire(import.meta.url);
function load(file) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { fileName: file, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, Date, Intl, Map, require(name) {
    if (name === "react/jsx-runtime") return realRequire(name);
    return load(`src/${name.slice(2)}.ts`);
  } });
  return exports;
}
const { studyTotals, studyStatistics } = load("src/lib/dashboard/statistics.ts");
const study = (id, status, duration_minutes, course_id = "a", scheduled_date = "2026-10-03") => ({ id, status, duration_minutes, course_id, scheduled_date, revision_stage: 1, start_time: "10:00", end_time: "11:00" });
const courses = [{ id: "a", code: "INF", name: "Algorithmie" }, { id: "b", code: "ANG", name: "Anglais", archived_at: "2026-10-01" }];
test("missed attempts and cancelled proposals never double count the current workload", () => {
  const totals = studyTotals([study("miss", "missed", 60), study("catchup", "completed", 60), study("next", "planned", 120), study("cancel", "cancelled", 900)]);
  assert.equal(totals.totalMinutes, 180); assert.equal(totals.completedMinutes, 60); assert.equal(totals.plannedMinutes, 120);
  assert.equal(totals.missedCount, 1); assert.equal(totals.percentage, 33);
});
test("group by stable course ID, retaining archived history and snapshot names when course is absent", () => {
  const rows = [study("1", "completed", 60), study("2", "planned", 90), study("3", "completed", 30, "b"), { ...study("4", "missed", 20, "gone"), course_code_snapshot: "OLD", course_name_snapshot: "Ancien cours" }];
  const stats = studyStatistics(rows, courses, "2026-10-03");
  const inf = stats.courses.find((c) => c.id === "a");
  assert.equal(inf.completedMinutes, 60); assert.equal(inf.plannedMinutes, 90); assert.equal(inf.percentage, 40);
  assert.equal(stats.courses.find((c) => c.id === "b").archived, true);
  assert.equal(stats.courses.find((c) => c.id === "gone").name, "Ancien cours");
  assert.equal(stats.courses.reduce((n, c) => n + c.totalMinutes, 0), stats.total.totalMinutes);
});
test("six Monday weeks span years; future plans count globally but not in past weekly totals", () => {
  const stats = studyStatistics([study("past", "completed", 30, "a", "2025-12-28"), study("now", "completed", 60, "a", "2026-01-01"), study("future", "planned", 90, "a", "2026-01-05")], courses, "2026-01-04");
  assert.equal(stats.weeks.length, 6); assert.equal(stats.weeks.at(-1).from, "2025-12-29"); assert.equal(stats.weeks.at(-1).to, "2026-01-04");
  assert.equal(stats.weeks.at(-1).completedMinutes, 60); assert.equal(stats.weeks.at(-2).completedMinutes, 30);
  assert.equal(stats.total.totalMinutes, 180); assert.equal(stats.total.plannedMinutes, 90);
});
test("validating old work later keeps the scheduled-week definition consistent with dashboard", () => {
  const stats = studyStatistics([{ ...study("done", "completed", 90, "a", "2026-09-20"), completed_at: "2026-10-03T16:00:00Z" }], courses, "2026-10-03");
  assert.equal(stats.weeks.at(-1).completedMinutes, 0); assert.equal(stats.weeks.at(-3).completedMinutes, 90);
});
test("real component renders totals, accessible per-course progress and honest missed-work labels", () => {
  const { StudyStatistics } = load("src/components/dashboard/study-statistics.tsx");
  const html = renderToStaticMarkup(StudyStatistics({ today: "2026-10-03", courses, studies: [study("done", "completed", 60), study("future", "planned", 90), study("miss", "missed", 60, "b")] }));
  assert.match(html, /40 %/); assert.match(html, /1 h 30 min/); assert.match(html, /Progression de INF/);
  assert.match(html, /ANG · Archivé/); assert.match(html, /ne sont pas ajoutées au temps encore planifié/);
  assert.match(html, /Suivi des six dernières semaines/);
  const empty = renderToStaticMarkup(StudyStatistics({ today: "2026-10-03", courses: [], studies: [] }));
  assert.match(empty, /Aucune séance planifiée ou terminée à mesurer/); assert.doesNotMatch(empty, /NaN|Infinity/);
});
