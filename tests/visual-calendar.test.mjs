import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRequire } from "node:module";
const realRequire = createRequire(import.meta.url);
// Keep these state/markup checks independent of Radix's browser portal and focus trap.
// The shared Sheet owns those interactions; browser QA checks the real component.
const sheet = {
  Sheet: Object.assign(({ children }) => React.createElement(React.Fragment, null, children), { displayName: "Sheet" }),
  SheetContent: ({ children, className }) => React.createElement("div", { role: "dialog", className }, children),
  SheetHeader: ({ children, className }) => React.createElement("header", { className }, children),
  SheetTitle: ({ children, className }) => React.createElement("h2", { className }, children),
  SheetDescription: ({ children, className }) => React.createElement("p", { className }, children),
};
function load(file, react = React) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { fileName: file, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, Date, Intl, Set, Map, require(name) {
    if (name === "react") return react;
    if (name === "react/jsx-runtime") return realRequire(name);
    if (name === "lucide-react") return realRequire(name);
    if (name === "@/components/ui/sheet") return sheet;
    return load(path.resolve(`src/${name.slice(2)}.ts`), react);
  } });
  return exports;
}
const { calendarDays, shiftMonth, calendarEvents, eventColumns } = load("src/lib/calendar/events.ts");
const course = { id: "a", code: "ANG", name: "Anglais", color: "#123456", starts_on: "2026-09-08", ends_on: "2026-12-15", course_sessions: [{ id: "s", day_of_week: 2, start_time: "14:00", end_time: "17:00" }], exams: [{ id: "e", title: "Final", exam_date: "2026-12-22", start_time: "14:00", end_time: "16:00" }] };
const study = { id: "r", course_id: "a", scheduled_date: "2026-12-22", start_time: "10:00", end_time: "11:00", status: "planned", revision_stage: 4, source_course_date: "2026-12-15" };
const data = { courses: [course], studies: [study], occurrences: [], courseStart: "2026-09-01", courseEnd: "2026-12-31" };
test("Monday weeks and whole month grids cross year boundaries without local timezone shifts", () => {
  assert.equal(calendarDays("2026-01-01", "week").join(","), "2025-12-29,2025-12-30,2025-12-31,2026-01-01,2026-01-02,2026-01-03,2026-01-04");
  const days = calendarDays("2026-03-31", "month");
  assert.equal(days.length, 42); assert.equal(days[0], "2026-02-23"); assert.equal(days.at(-1), "2026-04-05");
  assert.equal(shiftMonth("2026-01-31", 1), "2026-02-28"); assert.equal(shiftMonth("2028-01-31", 1), "2028-02-29");
});
test("personal periods stop classes but preserve saved revisions and exams after the last class", () => {
  const events = calendarEvents(data, calendarDays("2026-12-15", "month"));
  assert.ok(events.some((e) => e.kind === "course" && e.date === "2026-12-15"));
  assert.ok(!events.some((e) => e.kind === "course" && e.date > "2026-12-15"));
  assert.equal(events.filter((e) => e.kind === "revision")[0].sourceDate, "2026-12-15");
  assert.equal(events.filter((e) => e.kind === "exam").length, 1);
});
test("historical class snapshots override changed weekly hours and obsolete origins stay excluded", () => {
  const origins = [{ course_id: "a", source_course_session_key: "s", source_course_date: "2026-12-15", source_start_time: "09:00", source_end_time: "12:00", is_obsolete: false }];
  const events = calendarEvents({ ...data, occurrences: origins }, ["2026-12-15"]);
  assert.equal(events.length, 1); assert.equal(events[0].start, "09:00");
  const changed = { ...course, course_sessions: [{ ...course.course_sessions[0], effective_from: "2026-12-16" }] };
  assert.equal(calendarEvents({ ...data, courses: [changed], occurrences: [{ ...origins[0], is_obsolete: true }] }, ["2026-12-15"]).length, 0);
});
test("cancelled proposals are hidden, missed and completed snapshots remain visible for archived courses", () => {
  const events = calendarEvents({ ...data, courses: [{ ...course, archived_at: "2026-12-20" }], studies: ["cancelled", "completed", "missed"].map((status) => ({ ...study, id: status, status, course_code_snapshot: "OLD" })) }, ["2026-12-22"]);
  assert.equal(events.length, 2); assert.ok(events.every((e) => e.code === "OLD" && e.kind === "revision"));
});
test("simultaneous and visually adjacent short events get separate columns; later events use full width", () => {
  const items = eventColumns([{ ...study, id: "1", start: "10:00", end: "10:23" }, { ...study, id: "2", start: "10:23", end: "11:00" }, { ...study, id: "3", start: "12:00", end: "13:00" }]);
  assert.equal(items[0].columns, 2); assert.equal(items[1].lane, 1); assert.equal(items[2].columns, 1);
});
function harness(props) {
  const values = []; let index = 0;
  const react = { ...React, useMemo: (fn) => fn(), useState(initial) { const i = index++; if (!(i in values)) values[i] = initial; return [values[i], (value) => { values[i] = value; }]; }, useRef(initial) { const i = index++; if (!(i in values)) values[i] = { current: initial }; return values[i]; } };
  const { VisualCalendar } = load("src/components/calendar/visual-calendar.tsx", react);
  const render = () => { index = 0; return VisualCalendar(props); };
  const nodes = (node) => [node, ...React.Children.toArray(node?.props?.children).flatMap(nodes)];
  return {
    render,
    click(predicate, trigger = null) { const button = nodes(render()).find((node) => node?.type === "button" && predicate(node.props)); assert.ok(button, "button exists"); button.props.onClick({ currentTarget: trigger }); },
    closeDetail() {
      const all = nodes(render());
      const node = all.find((node) => node?.type === sheet.Sheet);
      const content = all.find((node) => node?.type === sheet.SheetContent);
      assert.ok(node, "detail is open"); node.props.onOpenChange(false);
      content.props.onCloseAutoFocus({ preventDefault() {} });
    },
  };
}
test("calendar controls change week/month, return to today, and reveal the source of a saved revision", () => {
  const app = harness({ today: "2026-12-22", data });
  let restoredFocus = 0;
  assert.match(renderToStaticMarkup(app.render()), /22 déc/);
  app.click((p) => p["aria-label"]?.startsWith("Révision · ANG"), { focus() { restoredFocus++; } });
  assert.match(renderToStaticMarkup(app.render()), /À revoir : le contenu du cours du 15 décembre 2026/);
  assert.match(renderToStaticMarkup(app.render()), /role="dialog"/);
  app.closeDetail();
  assert.equal(restoredFocus, 1, "closing the sheet returns keyboard focus to the opened session");
  assert.doesNotMatch(renderToStaticMarkup(app.render()), /role="dialog"/);
  app.click((p) => p.children === "Mois");
  assert.match(renderToStaticMarkup(app.render()), /Calendrier mensuel/);
  app.click((p) => p["aria-label"] === "Mois suivant");
  assert.match(renderToStaticMarkup(app.render()), /janvier 2027/);
  app.click((p) => p.children === "Aujourd’hui");
  assert.match(renderToStaticMarkup(app.render()), /décembre 2026/);
  app.click((p) => p["aria-label"] === "Voir les séances du 22 décembre 2026");
  assert.match(renderToStaticMarkup(app.render()), /Agenda du 22 décembre 2026/);
});

test("mobile day selection shows only that day's agenda and keeps short revisions readable", () => {
  const app = harness({ today: "2026-12-21", data: { ...data, studies: [{ ...study, start_time: "10:00", end_time: "10:23" }] } });
  const initial = renderToStaticMarkup(app.render());
  assert.match(initial, /Agenda du 21 décembre 2026/);
  assert.match(initial, /Aucune séance ce jour/);
  app.click((p) => p["aria-label"] === "Voir les séances du 22 décembre 2026");
  const html = renderToStaticMarkup(app.render());
  const agenda = html.slice(html.indexOf('aria-label="Agenda du 22 décembre 2026"'), html.indexOf('aria-label="Calendrier hebdomadaire"'));
  assert.match(agenda, /23 min/);
  assert.match(agenda, /À revoir : cours du 15 déc/);
  assert.match(agenda, /Révision 4/);
  assert.doesNotMatch(agenda, /Aucune séance ce jour/);
  app.click((p) => p["aria-label"] === "Semaine suivante");
  assert.match(renderToStaticMarkup(app.render()), /Agenda du 29 décembre 2026/);
});

test("month dates expose all sessions in an agenda and retain completed/missed labels", () => {
  const app = harness({ today: "2026-12-22", data: { ...data, studies: ["planned", "completed", "missed"].map((status, index) => ({ ...study, id: `r${index}`, status, start_time: `${10 + index}:00`, end_time: `${11 + index}:00` })) } });
  app.click((p) => p.children === "Mois");
  const html = renderToStaticMarkup(app.render());
  assert.match(html, /Calendrier mensuel/);
  assert.doesNotMatch(html, /min-w-\[850px\]/);
  assert.match(html, /aria-pressed="true"/);
  const agenda = html.slice(html.indexOf('aria-label="Agenda du 22 décembre 2026"'));
  assert.match(agenda, /4 séances/);
  assert.match(agenda, /Terminée/);
  assert.match(agenda, /Manquée · à rattraper/);
});

test("tapping the selected month view preserves its anchor after choosing an adjacent month day", () => {
  const app = harness({ today: "2026-12-22", data });
  app.click((p) => p.children === "Mois");
  for (const [date, label] of [["2026-11-30", "30 novembre 2026"], ["2027-01-03", "3 janvier 2027"]]) {
    app.click((p) => p["aria-label"] === `Voir les séances du ${label}`);
    app.click((p) => p.children === "Mois");
    const html = renderToStaticMarkup(app.render());
    assert.match(html, /aria-live="polite">décembre 2026<\/p>/);
    assert.match(html, new RegExp(`Agenda du ${label}`));
    assert.match(html, new RegExp(`dateTime="${date}"`, "i"));
  }
});
test("empty calendar gives a useful message and never fabricates classes without any period", () => {
  const app = harness({ today: "2026-12-22", data: { courses: [{ ...course, starts_on: null, ends_on: null, exams: [] }], studies: [], occurrences: [] } });
  const html = renderToStaticMarkup(app.render());
  assert.match(html, /Aucune séance dans cette période/); assert.match(html, /Renseigne les dates/);
});
