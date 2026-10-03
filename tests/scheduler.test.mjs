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
const { calculatePriority } = load("src/lib/scheduler/calculatePriority.ts");
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
test("semester may end after planning without generating later occurrences", () => {
  const input = fixture(); input.courseEnd = "2026-12-31";
  const result = generateSchedule(input);
  assert.equal(result.occurrences, 5);
  assert.ok(result.planned.every((revision) => revision.courseDate <= input.planningEnd && revision.scheduledDate <= input.planningEnd));
});
test("catch-up keeps the repetitions of each occurrence on distinct ordered days", () => {
  const input = fixture(); input.courseEnd = input.courseStart; input.planningStart = "2026-10-03"; input.planningEnd = "2026-10-25"; input.includeOverdue = true;
  const result = generateSchedule(input);
  assert.equal(result.planned.length, 4);
  const series = [...result.planned].sort((a,b) => a.stage-b.stage);
  assert.equal(new Set(series.map((r) => r.scheduledDate)).size, 4);
  const delta = (a,b) => (Date.parse(b)-Date.parse(a))/86400000;
  assert.equal(delta(series[0].scheduledDate, series[1].scheduledDate), 2);
  assert.equal(delta(series[1].scheduledDate, series[2].scheduledDate), 4);
  assert.equal(delta(series[2].scheduledDate, series[3].scheduledDate), 7);
  assert.equal(result.planned.reduce((n,r) => n+r.durationMinutes,0), 360);
});
test("new revisions have a configurable pause without counting it as study time", () => {
  const input = fixture(); input.courseEnd = input.courseStart; input.intervals = [1];
  input.courses[0].revision_multiplier = 0.5;
  input.courses.push({ ...input.courses[0], id: "b", code: "MAT", course_sessions: [{ ...input.courses[0].course_sessions[0], id: "t", course_id: "b" }] });
  input.breakMinutes = 20;
  let result = generateSchedule(input);
  assert.equal(result.planned.length, 2);
  assert.equal(result.planned[0].endTime, "18:30"); assert.equal(result.planned[1].startTime, "18:50");
  assert.equal(result.planned.reduce((n,r) => n+r.durationMinutes,0), 180);
  input.breakMinutes = 0; result = generateSchedule(input);
  assert.equal(result.planned[0].endTime, result.planned[1].startTime);
});
test("pause protects both sides of existing study revisions", () => {
  const input = fixture(); input.courseEnd=input.courseStart; input.intervals=[1]; input.courses[0].revision_multiplier=0.5;
  input.existing=[{ scheduled_date:"2026-09-15", start_time:"18:30", end_time:"19:30", status:"planned" }];
  const result = generateSchedule(input);
  assert.equal(result.planned[0].startTime,"19:45");
  assert.equal(result.planned[0].durationMinutes,90);
});
test("deadline compression still leaves one calendar day between repetitions", () => {
  const input=fixture(); input.courseEnd=input.courseStart;
  input.courses[0].exams=[{ id:"e",course_id:"a",title:"Exam",exam_date:"2026-09-19",start_time:"10:00",end_time:"12:00",importance:2,notes:"" }];
  const result=generateSchedule(input);
  assert.equal(result.planned.length,4);
  assert.equal(new Set(result.planned.map((r)=>r.scheduledDate)).size,4);
  assert.ok(result.planned.every((r)=>r.scheduledDate<"2026-09-19"));
});
test("not enough days places the possible prefix before reporting spacing", () => {
  const input=fixture(); input.courseEnd=input.courseStart;
  input.courses[0].exams=[{ id:"e",course_id:"a",title:"Exam",exam_date:"2026-09-17",start_time:"10:00",end_time:"12:00",importance:2,notes:"" }];
  const result=generateSchedule(input);
  assert.deepEqual(Array.from(result.planned,(r)=>r.stage),[1,2]);
  assert.deepEqual(Array.from(result.planned,(r)=>r.scheduledDate),["2026-09-15","2026-09-16"]);
  assert.equal(result.unscheduled[0].stage,3); assert.equal(result.unscheduled[0].reasonCode,"spacing");
  assert.equal(result.unscheduled[1].stage,4); assert.equal(result.unscheduled[1].reasonCode,"previous_unplaced");
  assert.ok(result.planned.every((r)=>r.scheduledDate>r.courseDate && r.scheduledDate<"2026-09-17"));
  assert.equal(result.planned.reduce((n,r)=>n+r.durationMinutes,0),180);
  assert.equal(result.unscheduled.reduce((n,r)=>n+r.durationMinutes,0),180);
});
test("dates beyond the planning horizon are reported instead of pulled earlier", () => {
  const input=fixture();input.courseEnd=input.courseStart;input.planningEnd="2026-09-22";
  const result=generateSchedule(input);
  const deferred=result.unscheduled.find((r)=>r.stage===4);
  assert.equal(deferred.reasonCode,"planning_end"); assert.match(deferred.reason,/2026-09-28/);
  assert.equal(result.planned.reduce((n,r)=>n+r.durationMinutes,0)+result.unscheduled.reduce((n,r)=>n+r.durationMinutes,0),360);
  assert.ok(result.unscheduled.every((r)=>!r.reason.includes("examen")));
});
test("break duration validation rejects invalid values", () => {
  for (const breakMinutes of [-1,1.5,61,NaN,Infinity]) assert.throws(()=>generateSchedule({...fixture(),breakMinutes}));
});
test("sparse availability is considered before placing the first repetition", () => {
  const input=fixture();input.courseEnd=input.courseStart;input.planningEnd="2026-09-20";input.intervals=[3,5];
  input.courses[0].course_sessions[0].end_time="19:00";
  input.courses[0].exams=[{ id:"e",course_id:"a",title:"Exam",exam_date:"2026-09-21",start_time:"10:00",end_time:"12:00",importance:2,notes:"" }];
  input.availability=[2,4].map((weekday)=>({ id:String(weekday),day_of_week:weekday,start_time:"10:00",end_time:"11:00" }));
  const result=generateSchedule(input);
  assert.equal(result.planned.length,2);assert.equal(result.unscheduled.length,0);
  assert.equal(result.planned[0].scheduledDate,"2026-09-15");assert.equal(result.planned[1].scheduledDate,"2026-09-17");
});
test("one available day still places the first repetition of an incomplete series", () => {
  const input=fixture();input.courseEnd=input.courseStart;input.planningEnd="2026-09-20";
  input.courses[0].exams=[{ id:"e",course_id:"a",title:"Exam",exam_date:"2026-09-21",start_time:"10:00",end_time:"12:00",importance:2,notes:"" }];
  input.availability=[{id:"tue",day_of_week:2,start_time:"10:00",end_time:"11:30"}];
  const result=generateSchedule(input);
  assert.equal(result.planned.length,1);assert.equal(result.planned[0].stage,1);
  assert.equal(result.planned[0].scheduledDate,"2026-09-15");
  assert.equal(result.planned[0].startTime,"10:00");assert.equal(result.planned[0].endTime,"11:30");
  assert.deepEqual(Array.from(result.unscheduled,(r)=>r.stage),[2,3,4]);
  assert.equal(result.unscheduled[0].reasonCode,"capacity");
  assert.ok(result.unscheduled.slice(1).every((r)=>r.reasonCode==="previous_unplaced"));
  assert.equal(result.planned.reduce((n,r)=>n+r.durationMinutes,0)+result.unscheduled.reduce((n,r)=>n+r.durationMinutes,0),360);
});

test("candidate selection keeps the longest possible prefix when the whole series cannot fit", () => {
  const input=fixture();input.courseEnd=input.courseStart;input.planningEnd="2026-09-20";input.intervals=[3,5,7];
  input.courses[0].course_sessions[0].end_time="19:00";
  input.courses[0].exams=[{ id:"e",course_id:"a",title:"Exam",exam_date:"2026-09-21",start_time:"10:00",end_time:"12:00",importance:2,notes:"" }];
  input.availability=[2,4].map((weekday)=>({id:String(weekday),day_of_week:weekday,start_time:"10:00",end_time:"10:40"}));
  const result=generateSchedule(input);
  assert.deepEqual(Array.from(result.planned,(r)=>r.stage),[1,2]);
  assert.deepEqual(Array.from(result.planned,(r)=>r.scheduledDate),["2026-09-15","2026-09-17"]);
  assert.equal(new Set(result.planned.map((r)=>r.scheduledDate)).size,2);
  assert.ok(result.planned.every((r)=>r.scheduledDate>r.courseDate && r.scheduledDate<"2026-09-21"));
  assert.ok(result.planned.every((r)=>r.startTime==="10:00" && r.endTime==="10:40"));
  assert.equal(result.unscheduled.length,1);assert.equal(result.unscheduled[0].stage,3);
  assert.equal(result.unscheduled[0].reasonCode,"capacity");
  assert.equal(result.planned.reduce((n,r)=>n+r.durationMinutes,0),80);
  assert.equal(result.unscheduled.reduce((n,r)=>n+r.durationMinutes,0),40);
});

test("pauses extend across midnight for new and existing revisions", () => {
  const input=fixture();input.courseEnd=input.courseStart;input.intervals=[1];
  input.courses[0].course_sessions[0].end_time="19:00";input.courses[0].revision_multiplier=1;
  input.courses.push({ ...input.courses[0], id:"b", course_sessions:[{...input.courses[0].course_sessions[0],id:"t",course_id:"b"}] });
  input.availability=[{id:"tue",day_of_week:2,start_time:"22:59",end_time:"23:59"},{id:"wed",day_of_week:3,start_time:"00:00",end_time:"01:15"}];
  let result=generateSchedule(input);
  assert.equal(result.planned[0].endTime,"23:59");assert.equal(result.planned[1].scheduledDate,"2026-09-16");assert.equal(result.planned[1].startTime,"00:14");
  input.courses.pop();input.existing=[{scheduled_date:"2026-09-15",start_time:"22:59",end_time:"23:59",status:"planned"}];
  result=generateSchedule(input);assert.equal(result.planned[0].startTime,"00:14");
  input.existing[0].status="cancelled";result=generateSchedule(input);assert.equal(result.planned[0].scheduledDate,"2026-09-15");
});
test("priority combines urgency, workload and importance", () => {
  assert.equal(calculatePriority(360,4,1),90);
  assert.equal(calculatePriority(240,10,1),24);
  assert.equal(calculatePriority(120,30,1),4);
  assert.ok(calculatePriority(360,4,3)>calculatePriority(360,4,1));
  assert.ok(calculatePriority(360,4,1)>calculatePriority(180,4,1));
  assert.equal(calculatePriority(360,null),0);
  assert.equal(calculatePriority(360,0),0);
  assert.equal(calculatePriority(360,-1),0);
  assert.equal(calculatePriority(0,4),0);
  for (const args of [[-1,4,1],[1.5,4,1],[360,1.5,1],[360,4,0],[360,4,4],[Infinity,4,1]]) assert.equal(calculatePriority(...args),null);
});
test("higher exam importance wins when courses compete for one slot", () => {
  const input=fixture(); input.courseEnd=input.courseStart;input.planningEnd="2026-09-15";input.intervals=[1];
  input.courses[0].revision_multiplier=0.5;
  input.courses[0].exams=[{id:"e",course_id:"a",title:"Exam",exam_date:"2026-09-20",start_time:"10:00",end_time:"12:00",importance:1,notes:""}];
  input.courses.push({...input.courses[0],id:"b",course_sessions:[{...input.courses[0].course_sessions[0],id:"t",course_id:"b"}],exams:[{...input.courses[0].exams[0],id:"f",course_id:"b",importance:3}]});
  input.availability=[{id:"tue",day_of_week:2,start_time:"10:00",end_time:"11:30"}];
  const result=generateSchedule(input);
  assert.equal(result.planned.length,1);assert.equal(result.planned[0].courseId,"b");
  assert.equal(result.unscheduled[0].courseId,"a");
  assert.equal(result.planned.reduce((n,r)=>n+r.durationMinutes,0)+result.unscheduled.reduce((n,r)=>n+r.durationMinutes,0),180);
});
