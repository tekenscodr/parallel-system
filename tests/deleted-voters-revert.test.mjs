import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("deleted_voters table and archiving logic integrity", async (t) => {
  await t.test("API route for delete archives record into deleted_voters", () => {
    const deleteRoute = fs.readFileSync("app/api/admin/executives/[id]/route.ts", "utf8");
    assert.ok(deleteRoute.includes("INSERT INTO deleted_voters"), "Must insert into deleted_voters");
    assert.ok(deleteRoute.includes("revert_status"), "Must track revert_status");
    assert.ok(deleteRoute.includes("deleted_by_id"), "Must track deleted_by_id");
  });

  await t.test("API route for listing deleted records exists with super user check", () => {
    const listRoute = fs.readFileSync("app/api/admin/executives/deleted/route.ts", "utf8");
    assert.ok(listRoute.includes("isAdminNational"), "Must enforce super user check via isAdminNational");
    assert.ok(listRoute.includes("FROM deleted_voters"), "Must query deleted_voters table");
    assert.ok(listRoute.includes("revert_status = ${status}"), "Must filter by revert_status");
  });

  await t.test("API route for reverting deleted records restores to executives_all", () => {
    const revertRoute = fs.readFileSync("app/api/admin/executives/deleted/[id]/revert/route.ts", "utf8");
    assert.ok(revertRoute.includes("isAdminNational"), "Must enforce super user check");
    assert.ok(revertRoute.includes("INSERT INTO executives_all"), "Must re-insert into executives_all");
    assert.ok(revertRoute.includes("UPDATE deleted_voters"), "Must mark record as RESTORED");
    assert.ok(revertRoute.includes("EXECUTIVE_RESTORE"), "Must log audit event for restore");
  });

  await t.test("Dashboard UI provides super-user revert modal and action buttons", () => {
    const dashboard = fs.readFileSync("app/admin/dashboard/page.tsx", "utf8");
    assert.ok(dashboard.includes("Deleted Voters / Revert"), "Must include button in action bar");
    assert.ok(dashboard.includes("handleRevert"), "Must implement revert handler");
    assert.ok(dashboard.includes("fetchDeletedRecords"), "Must implement deleted records fetch");
    assert.ok(dashboard.includes("Deleted Voters &amp; Executives Archive") || dashboard.includes("Deleted Voters & Executives Archive"), "Must include modal header");
  });
});
