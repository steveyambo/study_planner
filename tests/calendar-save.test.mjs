import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { NextRequest, NextResponse } from "next/server.js";

const proposed = [{ courseId: "own-course", sourceId: "own-source", courseDate: "2026-10-05", stage: 1, intervalDays: 1, durationMinutes: 90, desiredDate: "2026-10-06", scheduledDate: "2026-10-06", startTime: "10:00", endTime: "11:30" }];
function loadModule(path, dependencies = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,{exports,require:(name)=>dependencies[name],URL});
  return exports;
}
function setup({ existing = [], occurrences = [], historyVersion = 1, periodVersion = 1, missedVersion = 1, optionalLimitVersion = 1, occurrenceError = null, planned = proposed, revision = 7, rpcError = null, pageLimit = 1000, pageErrorAt = null } = {}) {
  const writes = [], filters = [], inputs = [], ranges = [], orders = [];
  const data = { profiles: { timezone: "America/New_York", planning_revision: revision, planning_history_version: historyVersion, course_period_version: periodVersion, missed_sessions_version: missedVersion, optional_daily_limit_version: optionalLimitVersion }, courses: [], availabilities: [], revision_rules: { intervals: [1,3,7,14] }, study_sessions: existing, course_occurrences: occurrences };
  const supabase = {
    from(table) {
      let from = 0, to = Infinity;
      const query = {
        select: () => query,
        eq: (column,value) => { filters.push({column,value}); return query; },
        order: (column) => { orders.push({table,column}); return query; },
        range: (start,end) => { from=start;to=end;ranges.push({table,from,to});return query; },
        maybeSingle: async () => ({data:data[table],error:null}),
        then: (resolve) => {
          const rows = table === "study_sessions" ? existing : occurrences;
          const response = table === "course_occurrences" && occurrenceError ? {data:null,error:occurrenceError} : table === "study_sessions" || table === "course_occurrences" ? from === pageErrorAt ? {data:null,error:{message:"page_failed"}} : {data:rows.slice(from, Math.min(to + 1, from + pageLimit)),error:null} : {data:data[table],error:null};
          return Promise.resolve(response).then(resolve);
        },
      };
      return query;
    },
    rpc: async (name,args) => { writes.push({name,args}); return {error:rpcError}; },
  };
  const dependencies = {
    "next/server": {NextResponse},
    "@/lib/supabase/require-user": {requireUser: async () => ({supabase,userId:"actual-account"})},
    "@/lib/supabase/load-study-sessions": loadModule("src/lib/supabase/load-study-sessions.ts"),
    "@/lib/scheduler/generateSchedule": {generateSchedule: (input) => {inputs.push(input); return {planned};}},
    "@/lib/scheduler/revision-intervals": {DEFAULT_REVISION_INTERVALS:[1,3,7,14]},
    "@/lib/utils/calendar-date": {todayInTimezone: () => "2026-10-03"},
  };
  const exports = loadModule("src/app/calendar/save/route.ts",dependencies);
  return {POST:exports.POST,writes,filters,inputs,ranges,orders};
}
function request(fields = {}, origin="http://localhost:3000") {
  return new NextRequest("http://localhost:3000/calendar/save",{method:"POST",headers:{origin,"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({courseStart:"2026-10-05",courseEnd:"2026-10-05",planningStart:"2026-10-04",planningEnd:"2026-10-20",breakMinutes:"15",preview:JSON.stringify(proposed),expectedRevision:"7",user_id:"foreign-account",...fields}).toString()});
}

test("replacement recomputes server rows and reads only the authenticated account",async()=>{
  const context=setup();const response=await context.POST(request({includeOverdue:"on"}));
  assert.equal(response.status,303);assert.match(response.headers.get("location"),/result=saved/);
  assert.equal(response.headers.get("cache-control"),"private, no-store");
  assert.equal(context.writes.length,1);assert.equal(context.writes[0].name,"replace_schedule");
  const args=context.writes[0].args;
  assert.equal(args.p_sessions[0].course_id,"own-course");
  assert.equal(args.p_sessions[0].source_course_date,"2026-10-05");
  assert.equal(args.p_sessions[0].revision_interval_days,1);
  assert.equal(args.p_expected_revision,"7");assert.equal(args.p_include_overdue,true);
  assert.equal(args.p_planning_start,"2026-10-04");assert.equal(args.p_planning_end,"2026-10-20");
  assert.ok(context.filters.every((filter)=>filter.value==="actual-account"));
  assert.equal(context.inputs[0].breakMinutes,15);assert.equal(context.inputs[0].today,"2026-10-03");
});
test("stale or forged preview is refused without writing",async()=>{
  const context=setup();const response=await context.POST(request({preview:"[]"}));
  assert.match(response.headers.get("location"),/result=changed/);assert.equal(context.writes.length,0);
});
test("replanning passes completed and future studies to the engine instead of denying a second generation",async()=>{
  const existing=[{status:"completed",scheduled_date:"2026-10-01"},{status:"planned",scheduled_date:"2026-10-06"}];
  const context=setup({existing});const response=await context.POST(request());
  assert.match(response.headers.get("location"),/result=saved/);assert.equal(context.writes.length,1);
  assert.equal(context.inputs[0].existing.length,existing.length);
  assert.equal(context.inputs[0].existing[0],existing[0]);
});
test("empty recomputed preview can remove future planned rows atomically",async()=>{
  const context=setup({planned:[],existing:[{status:"planned",scheduled_date:"2026-10-06"}]});
  const response=await context.POST(request({preview:"[]"}));
  assert.match(response.headers.get("location"),/result=saved/);assert.equal(context.writes.length,1);
  assert.equal(context.writes[0].args.p_sessions.length,0);
});
test("newer data revision refuses even an otherwise identical preview",async()=>{
  const context=setup({revision:8});const response=await context.POST(request());
  assert.match(response.headers.get("location"),/result=changed/);assert.equal(context.writes.length,0);assert.equal(context.inputs.length,0);
});
test("missing expected revision refuses without writing",async()=>{
  const context=setup();const response=await context.POST(request({expectedRevision:""}));
  assert.match(response.headers.get("location"),/result=changed/);assert.equal(context.writes.length,0);
});
test("missing migration is reported gracefully before computing or writing",async()=>{
  const context=setup({revision:null});const response=await context.POST(request());
  assert.match(response.headers.get("location"),/result=migration/);assert.equal(context.writes.length,0);assert.equal(context.inputs.length,0);
});
test("a revision changed during the RPC is reported as stale",async()=>{
  const context=setup({rpcError:{code:"P0001",message:"stale_revision"}});const response=await context.POST(request());
  assert.match(response.headers.get("location"),/result=changed/);
});
test("a missing RPC is reported as migration required",async()=>{
  const context=setup({rpcError:{code:"PGRST202",message:"function not found"}});const response=await context.POST(request());
  assert.match(response.headers.get("location"),/result=migration/);
});
test("past planning start is refused without writing",async()=>{
  const context=setup();const response=await context.POST(request({planningStart:"2026-10-03"}));
  assert.match(response.headers.get("location"),/result=invalid/);assert.equal(context.writes.length,0);
});
test("foreign origin is refused before reading user data",async()=>{
  const context=setup();const response=await context.POST(request({},"https://other.example"));
  assert.equal(response.status,403);assert.equal(context.filters.length,0);
});

test("all history beyond 1000 rows including recent completed work reaches the engine",async()=>{
  const existing=Array.from({length:1100},(_,index)=>({id:`history-${index}`,status:"cancelled",scheduled_date:"2026-09-01"}));
  existing.push({id:"recent-completed",status:"completed",scheduled_date:"2026-10-02",duration_minutes:90});
  const context=setup({existing});const response=await context.POST(request());
  assert.match(response.headers.get("location"),/result=saved/);
  assert.equal(context.inputs[0].existing.length,1101);
  assert.equal(context.inputs[0].existing.at(-1).id,"recent-completed");
  assert.equal(context.ranges.filter((range)=>range.table==="study_sessions").length,3);
  assert.deepEqual(context.ranges.filter((range)=>range.table==="study_sessions").map((range)=>range.from),[0,1000,1101]);
  assert.deepEqual(context.orders.slice(0,3).map((order)=>order.column),["scheduled_date","start_time","id"]);
  assert.ok(context.filters.every((filter)=>filter.value==="actual-account"));
});

test("a configured smaller row limit is paginated until an empty page",async()=>{
  const existing=Array.from({length:650},(_,index)=>({id:`history-${index}`,status:"cancelled",scheduled_date:"2026-09-01"}));
  const context=setup({existing,pageLimit:250});const response=await context.POST(request());
  assert.match(response.headers.get("location"),/result=saved/);
  assert.equal(context.inputs[0].existing.length,650);
  assert.deepEqual(context.ranges.filter((range)=>range.table==="study_sessions").map((range)=>range.from),[0,250,500,650]);
});

test("a later failed history page prevents computing and saving a partial history",async()=>{
  const existing=Array.from({length:1100},(_,index)=>({id:`history-${index}`,status:"cancelled",scheduled_date:"2026-09-01"}));
  const context=setup({existing,pageErrorAt:1000});const response=await context.POST(request());
  assert.match(response.headers.get("location"),/result=failed/);
  assert.equal(context.writes.length,0);assert.equal(context.inputs.length,0);
});

test("durable origins reach the engine without cancelled proposals",async()=>{
  const occurrences=[{course_id:"own-course",source_course_session_key:"own-source",source_course_date:"2026-09-14",source_start_time:"18:00",source_end_time:"21:00",is_obsolete:false}];
  const context=setup({occurrences});const response=await context.POST(request());
  assert.match(response.headers.get("location"),/result=saved/);assert.equal(context.inputs[0].occurrences[0],occurrences[0]);
  assert.equal(context.inputs[0].existing.length,0);
});

test("the old replanning schema cannot save without the cleanup migration",async()=>{
  for (const options of [{historyVersion:null},{occurrenceError:{code:"PGRST205"}}]) {
    const context=setup(options);const response=await context.POST(request());
    assert.match(response.headers.get("location"),/result=migration/);assert.equal(context.writes.length,0);assert.equal(context.inputs.length,0);
  }
});

test("all durable origins are paginated before generating the schedule",async()=>{
  const occurrences=Array.from({length:1101},(_,index)=>({id:String(index),source_course_date:"2026-09-14",is_obsolete:false}));
  const context=setup({occurrences});const response=await context.POST(request());
  assert.match(response.headers.get("location"),/result=saved/);assert.equal(context.inputs[0].occurrences.length,1101);
  assert.deepEqual(context.ranges.filter((range)=>range.table==="course_occurrences").map((range)=>range.from),[0,1000,1101]);
});

test("an origin read failure prevents saving incomplete remaining work",async()=>{
  const context=setup({occurrenceError:{code:"XX000",message:"read_failed"}});const response=await context.POST(request());
  assert.match(response.headers.get("location"),/result=failed/);assert.equal(context.writes.length,0);assert.equal(context.inputs.length,0);
});

test("missing per-course period migration refuses saving before computing or writing", async () => {
  const context = setup({ periodVersion: null });
  const response = await context.POST(request());
  assert.match(response.headers.get("location"), /result=migration/);
  assert.equal(context.writes.length, 0); assert.equal(context.inputs.length, 0);
});

test("daily cap is passed to engine and SQL; invalid caps cannot be saved", async () => {
  const context = setup();
  await context.POST(request({ dailyLimitEnabled: "on", maxDailyMinutes: "180" }));
  assert.equal(context.inputs[0].maxDailyMinutes, 180);
  assert.equal(context.writes[0].args.p_max_daily_minutes, 180);
  for (const cap of ["14", "1441", "90.5", "bad"]) {
    const invalid = setup(); await invalid.POST(request({ dailyLimitEnabled: "on", maxDailyMinutes: cap })); assert.equal(invalid.writes.length, 0);
  }
});
test("daily cap migration and SQL conflict have actionable results", async () => {
  const old = setup({ missedVersion: null });
  assert.match((await old.POST(request())).headers.get("location"), /result=migration/); assert.equal(old.writes.length, 0);
  const conflict = setup({ rpcError: { message: "daily_limit" } });
  assert.match((await conflict.POST(request())).headers.get("location"), /result=daily_limit/);
});

test("unchecked optional cap ignores the numeric field and passes null to engine and database", async () => {
  for (const fields of [{}, { maxDailyMinutes: "bad" }, { dailyLimitEnabled: "off", maxDailyMinutes: "240" }]) {
    const context = setup(); await context.POST(request(fields));
    assert.equal(context.inputs[0].maxDailyMinutes, null);
    assert.equal(context.writes[0].args.p_max_daily_minutes, null);
  }
  const old = setup({ optionalLimitVersion: null });
  assert.match((await old.POST(request())).headers.get("location"), /result=migration/);
  assert.equal(old.writes.length, 0);
});
