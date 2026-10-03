import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { NextRequest, NextResponse } from "next/server.js";

const proposed = [{ courseId: "own-course", sourceId: "own-source", courseDate: "2026-10-05", stage: 1, durationMinutes: 90, desiredDate: "2026-10-06", scheduledDate: "2026-10-06", startTime: "10:00", endTime: "11:30" }];
function setup(existing = []) {
  const writes = [], filters = [], inputs = [];
  const data = { profiles: { timezone: "America/New_York" }, courses: [], availabilities: [], revision_rules: { intervals: [1,3,7,14] }, study_sessions: existing };
  const supabase = {
    from(table) {
      const query = { select: () => query, eq: (column,value) => { filters.push({column,value}); return query; }, maybeSingle: async () => ({data:data[table],error:null}), then: (resolve) => Promise.resolve({data:data[table],error:null}).then(resolve) };
      return query;
    },
    rpc: async (name,args) => { writes.push({name,args}); return {error:null}; },
  };
  const dependencies = {
    "next/server": {NextResponse},
    "@/lib/supabase/require-user": {requireUser: async () => ({supabase,userId:"actual-account"})},
    "@/lib/scheduler/generateSchedule": {generateSchedule: (input) => {inputs.push(input); return {planned:proposed};}},
    "@/lib/scheduler/revision-intervals": {DEFAULT_REVISION_INTERVALS:[1,3,7,14]},
    "@/lib/utils/calendar-date": {todayInTimezone: () => "2026-10-03"},
  };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync("src/app/calendar/save/route.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,{exports,require:(name)=>dependencies[name],URL});
  return {POST:exports.POST,writes,filters,inputs};
}
function request(preview = JSON.stringify(proposed), origin="http://localhost:3000") {
  return new NextRequest("http://localhost:3000/calendar/save",{method:"POST",headers:{origin,"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({courseStart:"2026-10-05",courseEnd:"2026-10-05",planningStart:"2026-10-04",planningEnd:"2026-10-20",breakMinutes:"15",preview,user_id:"foreign-account"}).toString()});
}
test("save recomputes server rows and reads only the authenticated account",async()=>{
  const context=setup();const response=await context.POST(request());
  assert.equal(response.status,303);assert.match(response.headers.get("location"),/result=saved/);
  assert.equal(context.writes.length,1);assert.equal(context.writes[0].name,"save_initial_schedule");
  assert.equal(context.writes[0].args.p_sessions[0].course_id,"own-course");
  assert.equal(context.writes[0].args.p_sessions[0].source_course_date,"2026-10-05");
  assert.ok(context.filters.every((filter)=>filter.value==="actual-account"));
  assert.equal(context.inputs[0].breakMinutes,15);
});
test("stale or forged preview is refused without writing",async()=>{
  const context=setup();const response=await context.POST(request("[]"));
  assert.match(response.headers.get("location"),/result=changed/);assert.equal(context.writes.length,0);
});
test("second generation is refused without writing",async()=>{
  const context=setup([{status:"completed"}]);const response=await context.POST(request());
  assert.match(response.headers.get("location"),/result=exists/);assert.equal(context.writes.length,0);
});
test("foreign origin is refused before reading user data",async()=>{
  const context=setup();const response=await context.POST(request(undefined,"https://other.example"));
  assert.equal(response.status,403);assert.equal(context.filters.length,0);
});
