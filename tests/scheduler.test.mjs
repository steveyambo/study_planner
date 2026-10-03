import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

function load(file) {
  const absolute = path.resolve(file);
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(absolute, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, require: (name) => load(name.startsWith("@/") ? `src/${name.slice(2)}.ts` : path.resolve(path.dirname(absolute), `${name}.ts`)) });
  return exports;
}
const { findAvailableSlots } = load("src/lib/scheduler/findAvailableSlots.ts");
const { generateSchedule } = load("src/lib/scheduler/generateSchedule.ts");
function fixture() {
  return { courses: [{ id: "a", code: "INF", name: "Info", color: "#000000", revision_multiplier: 2, course_sessions: [{ id: "s", course_id: "a", day_of_week: 1, start_time: "18:00", end_time: "21:00" }], exams: [] }], availability: Array.from({ length: 7 }, (_, i) => ({ id: String(i), day_of_week: i + 1, start_time: "17:00", end_time: "22:00" })), existing: [], intervals: [1,3,7,14], courseStart: "2026-09-14", courseEnd: "2026-09-28", planningStart: "2026-09-15", planningEnd: "2026-10-15", includeOverdue: false };
}
test("availability is merged and occupied periods are subtracted", () => {
  const slots = findAvailableSlots([{ start: 1020, end: 1320 }, { start: 1080, end: 1200 }], [{ start: 1020, end: 1110 }]);
  assert.equal(slots.length, 1); assert.equal(slots[0].start, 1110); assert.equal(slots[0].end, 1320);
});
test("all weekly occurrences are included and minutes conserved without conflicts", () => {
  const input = fixture(); const original = JSON.stringify(input); const result = generateSchedule(input);
  assert.equal(result.occurrences, 3); assert.equal(result.planned.length, 12); assert.equal(result.unscheduled.length, 0);
  assert.equal(result.planned.reduce((n,r) => n+r.durationMinutes,0), 1080); assert.equal(JSON.stringify(input), original);
  for (let i=0;i<result.planned.length;i++) {
    const a=result.planned[i]; assert.ok(a.scheduledDate>a.courseDate);
    if (new Date(`${a.scheduledDate}T00:00:00Z`).getUTCDay()===1 && a.scheduledDate<=input.courseEnd) assert.ok(a.endTime<="18:00" || a.startTime>="21:00");
    for (const b of result.planned.slice(i+1)) if(a.scheduledDate===b.scheduledDate) assert.ok(a.endTime<=b.startTime || b.endTime<=a.startTime);
  }
});
test("exams and existing revisions block time and exam deadline is respected", () => {
  const input=fixture(); input.courseEnd=input.courseStart;
  input.courses[0].exams=[{ id:"e",course_id:"a",title:"Exam",exam_date:"2026-09-20",start_time:"17:00",end_time:"20:00",importance:2,notes:"" }];
  input.existing=[{scheduled_date:"2026-09-15",start_time:"17:00",end_time:"19:00",status:"planned"}];
  const result=generateSchedule(input); assert.equal(result.planned.length,4);
  for (const r of result.planned) {assert.ok(r.scheduledDate<"2026-09-20");if(r.scheduledDate==="2026-09-15")assert.ok(r.startTime>="19:00");}
});
test("past revisions are excluded unless explicitly included for catch-up", () => {
  const input=fixture();input.courseEnd=input.courseStart;input.planningStart="2026-10-03";
  const excluded=generateSchedule(input);assert.equal(excluded.excludedMinutes,360);assert.equal(excluded.planned.length,0);
  input.includeOverdue=true;const included=generateSchedule(input);assert.equal(included.planned.reduce((n,r)=>n+r.durationMinutes,0),360);
});
test("insufficient capacity is reported, never silently discarded", () => {
  const input=fixture();input.availability=[];const result=generateSchedule(input);
  assert.equal(result.planned.length,0);assert.equal(result.unscheduled.reduce((n,r)=>n+r.durationMinutes,0),1080);
});
test("invalid and excessive periods are rejected", () => {
  assert.throws(()=>generateSchedule({...fixture(),courseStart:"2026-02-30"}));
  assert.throws(()=>generateSchedule({...fixture(),planningEnd:"2027-10-15"}));
});
