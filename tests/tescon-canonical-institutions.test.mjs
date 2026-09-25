import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  normalizeTesconInstitution,
  CANONICAL_TESCON_QUOTAS_BY_REGION,
  TOTAL_CANONICAL_TESCON_INSTITUTIONS,
  getCanonicalTesconQuota,
} from "../lib/tescon-institutions.ts";
import { getTesconInstitution } from "../lib/album-hierarchy.ts";

test("TESCON Statutory Directory has exactly 251 accredited tertiary institutions nationwide", () => {
  assert.equal(TOTAL_CANONICAL_TESCON_INSTITUTIONS, 251);

  const sumQuotas = Object.values(CANONICAL_TESCON_QUOTAS_BY_REGION).reduce((acc, q) => acc + q, 0);
  assert.equal(sumQuotas, 251, "Sum of all 16 regional quotas must equal 251");

  assert.equal(getCanonicalTesconQuota("all"), 251);
  assert.equal(getCanonicalTesconQuota("Ashanti"), 49);
  assert.equal(getCanonicalTesconQuota("Greater Accra"), 35);
  assert.equal(getCanonicalTesconQuota("Ahafo"), 8);
  assert.equal(getCanonicalTesconQuota("Bono"), 15);
  assert.equal(getCanonicalTesconQuota("Bono East"), 8);
  assert.equal(getCanonicalTesconQuota("Central"), 15);
  assert.equal(getCanonicalTesconQuota("Eastern"), 24);
  assert.equal(getCanonicalTesconQuota("North East"), 4);
  assert.equal(getCanonicalTesconQuota("Northern"), 20);
  assert.equal(getCanonicalTesconQuota("Oti"), 3);
  assert.equal(getCanonicalTesconQuota("Savannah"), 7);
  assert.equal(getCanonicalTesconQuota("Upper East"), 13);
  assert.equal(getCanonicalTesconQuota("Upper West"), 13);
  assert.equal(getCanonicalTesconQuota("Volta"), 17);
  assert.equal(getCanonicalTesconQuota("Western"), 14);
  assert.equal(getCanonicalTesconQuota("Western North"), 6);
});

test("Normalizes all 741 certified TESCON delegates into exactly 251 canonical institutions (435 -> 251)", () => {
  const delegates = JSON.parse(fs.readFileSync("scratch/all_tescon_741_delegates.json", "utf8"));
  assert.equal(delegates.length, 741, "Must contain all 741 certified voting delegates");

  const unmapped = [];
  const nationwideInstitutions = new Set();
  const regionalInstitutions = {};

  for (const d of delegates) {
    const institution = getTesconInstitution({
      polling_station: d.ps,
      constituency: d.con,
      region: d.reg,
      id: d.id,
    });

    if (!institution || institution === "Accredited Tertiary Institution") {
      unmapped.push(d);
    }

    nationwideInstitutions.add(institution);

    if (!regionalInstitutions[d.reg]) regionalInstitutions[d.reg] = new Set();
    regionalInstitutions[d.reg].add(institution);
  }

  assert.equal(unmapped.length, 0, "All 741 delegates must resolve to a valid canonical institution");
  assert.equal(
    nationwideInstitutions.size,
    251,
    `Nationwide unique institutions must be exactly 251, got ${nationwideInstitutions.size} (previously inflated to 435)`
  );

  // Verify single-officer contests (e.g. 250 Presidents)
  const presidents = delegates.filter((d) => d.pos === "TESCON President");
  assert.equal(presidents.length, 250);
  const presidentInstitutions = new Set(
    presidents.map((d) =>
      getTesconInstitution({
        polling_station: d.ps,
        constituency: d.con,
        region: d.reg,
        id: d.id,
      })
    )
  );
  assert.equal(
    presidentInstitutions.size,
    245,
    "Presidents map to 245 unique institutions (5 institutions have multiple campus/president entries)"
  );
});

test("Regional canonical institution quotas evaluate accurately", () => {
  const delegates = JSON.parse(fs.readFileSync("scratch/all_tescon_741_delegates.json", "utf8"));

  // Check specific regional quotas
  const ahafoInstitutions = new Set(
    delegates
      .filter((d) => d.reg === "Ahafo")
      .map((d) =>
        getTesconInstitution({
          polling_station: d.ps,
          constituency: d.con,
          region: d.reg,
          id: d.id,
        })
      )
  );
  assert.equal(ahafoInstitutions.size, 8, "Ahafo must have exactly 8 institutions");

  const ashantiInstitutions = new Set(
    delegates
      .filter((d) => d.reg === "Ashanti")
      .map((d) =>
        getTesconInstitution({
          polling_station: d.ps,
          constituency: d.con,
          region: d.reg,
          id: d.id,
        })
      )
  );
  assert.equal(ashantiInstitutions.size, 49, "Ashanti must have exactly 49 institutions");

  const gaInstitutions = new Set(
    delegates
      .filter((d) => d.reg === "Greater Accra")
      .map((d) =>
        getTesconInstitution({
          polling_station: d.ps,
          constituency: d.con,
          region: d.reg,
          id: d.id,
        })
      )
  );
  assert.equal(gaInstitutions.size, 35, "Greater Accra must have exactly 35 institutions");

  const northernInstitutions = new Set(
    delegates
      .filter((d) => d.reg === "Northern")
      .map((d) =>
        getTesconInstitution({
          polling_station: d.ps,
          constituency: d.con,
          region: d.reg,
          id: d.id,
        })
      )
  );
  assert.equal(northernInstitutions.size, 20, "Northern must have exactly 20 institutions");

  const westernInstitutions = new Set(
    delegates
      .filter((d) => d.reg === "Western")
      .map((d) =>
        getTesconInstitution({
          polling_station: d.ps,
          constituency: d.con,
          region: d.reg,
          id: d.id,
        })
      )
  );
  assert.equal(westernInstitutions.size, 14, "Western must have exactly 14 institutions");
});
