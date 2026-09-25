import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("Election album route renders Age on cards for Youth Organiser album", () => {
  const routePath = path.join(process.cwd(), "app/api/admin/albums/election/route.ts");
  const code = fs.readFileSync(routePath, "utf8");

  // Route must detect youth contest/album
  assert.ok(code.includes("const isYouthAlbum ="), "Route must define isYouthAlbum in renderVoterCard");
  assert.ok(code.includes('date_of_birth: r.date_of_birth ? String(r.date_of_birth).trim() : null,'), "Route must include date_of_birth on delegate object");

  // Voter card must render Age when isYouthAlbum is true
  assert.ok(code.includes('${isYouthAlbum ? `'), "Voter card must conditionally check isYouthAlbum for Age");
  assert.ok(code.includes('<span class="lbl">Age:</span>'), "Voter card must render Age label for youth delegates");
  assert.ok(code.includes('${ageVal}'), "Voter card must render ageVal");

  // Excel must populate age with under 40 fallback and date of birth
  assert.ok(code.includes('d.age !== null && d.age !== undefined ? d.age : (d.is_under_40 ? "Under 40" : "—"),'), "Excel must populate age with fallback");
  assert.ok(code.includes('d.date_of_birth || "—"'), "Excel must include date_of_birth");
});

test("Admin album page includes Age column and auto-selects demographics for youth contests", () => {
  const pagePath = path.join(process.cwd(), "app/admin/albums/page.tsx");
  const code = fs.readFileSync(pagePath, "utf8");

  // Must declare isYouthContest
  assert.ok(code.includes("const isYouthContest ="), "Page must define isYouthContest");
  assert.ok(code.includes('isYouthContest ? "Age / Status" : "Demographics"'), "Table header must display Age / Status for youth contests");

  // handleContestSelect must auto-include demographics when youth contest is selected
  assert.ok(code.includes('val === "Youth Organiser"'), "handleContestSelect must handle Youth Organiser");
  assert.ok(code.includes('setSelectedDetails((prev) => (prev.includes("demographics") ? prev : [...prev, "demographics"]))'), "handleContestSelect must ensure demographics is selected for youth");
});
