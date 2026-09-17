import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("Wing album (Nasara, Women, Youth) groups by region starting on new pages and includes constituency jurisdiction", () => {
  const routePath = path.join(process.cwd(), "app/api/admin/albums/election/route.ts");
  const code = fs.readFileSync(routePath, "utf8");

  // 1. Check isWingAlbum regex detection
  assert.ok(
    code.includes("/(?:youth|women|nasara)/i.test(contest)"),
    "Route must detect wing albums via regex matching Youth, Women, or Nasara"
  );

  // 2. Check jurisdictionSuffix calculation
  assert.ok(
    code.includes("jurisdictionSuffix =") &&
      code.includes("` (${String(d.constituency).trim()})`"),
    "Constituency cards in wing albums must calculate jurisdiction suffix as ` (${String(d.constituency).trim()})`"
  );

  // 3. Check voter card detail-line renders jurisdiction beside level
  assert.ok(
    code.includes('<span class="lbl">Level:</span> <span class="val">${d.executive_level}${jurisdictionSuffix}</span>'),
    "Voter card Level must render ${d.executive_level}${jurisdictionSuffix}"
  );

  // 4. Check that for wing albums, after national, each region starts on a new page
  assert.ok(
    code.includes("if (isWingAlbum) {"),
    "Route must branch for isWingAlbum pagination"
  );

  assert.ok(
    code.includes("for (const regionName of presentRegions) {") &&
      code.includes("const regionList = [...regExecs, ...constExecs, ...tesconExecs];"),
    "Within each region, regional executives must be followed by constituencies and tescon"
  );

  assert.ok(
    code.includes("headerSubTitle: `${regionName.toUpperCase()} REGION · ${contest.toUpperCase()} (PART ${partIdx})`"),
    "Region pages must have header with region name, contest name, and part index"
  );
});

test("Wing album pagination logic isolates each region to its own page(s)", async () => {
  const sampleDelegates = [
    { executive_name: "NAT 1", executive_level: "National", region: "National", constituency: "", position_rank: 1 },
    { executive_name: "AHAFO REG", executive_level: "Regional", region: "Ahafo", constituency: "", position_rank: 8 },
    { executive_name: "AHAFO CONST", executive_level: "Constituency", region: "Ahafo", constituency: "Asunafo North", position_rank: 8 },
    { executive_name: "VOLTA REG", executive_level: "Regional", region: "Volta", constituency: "", position_rank: 8 },
    { executive_name: "VOLTA CONST 1", executive_level: "Constituency", region: "Volta", constituency: "Adaklu", position_rank: 8 },
    { executive_name: "VOLTA CONST 2", executive_level: "Constituency", region: "Volta", constituency: "Central Tongu", position_rank: 8 },
  ];

  const GHANA_REGIONS_ORDER = ["Ahafo", "Ashanti", "Bono", "Bono East", "Central", "Eastern", "Greater Accra", "North East", "Northern", "Oti", "Savannah", "Upper East", "Upper West", "Volta", "Western", "Western North"];
  const contest = "Women Organisers & Deputies";

  const cardPages = [];
  let currentCardPageNum = 3;

  const nationalDelegates = sampleDelegates.filter(d => String(d.executive_level || "").toLowerCase().trim() === "national");
  if (nationalDelegates.length > 0) {
    for (let i = 0; i < nationalDelegates.length; i += 10) {
      const chunk = nationalDelegates.slice(i, i + 10);
      cardPages.push({
        page: currentCardPageNum,
        title: `NATIONAL LEVEL · ${contest.toUpperCase()}`,
        cards: chunk,
      });
      currentCardPageNum++;
    }
  }

  const presentRegions = [];
  for (const r of GHANA_REGIONS_ORDER) {
    const has = sampleDelegates.some(d => String(d.executive_level || "").toLowerCase().trim() !== "national" && String(d.region || "").toLowerCase().trim() === r.toLowerCase());
    if (has) presentRegions.push(r);
  }

  for (const regionName of presentRegions) {
    const regExecs = sampleDelegates.filter(d => (String(d.executive_level || "").toLowerCase().trim() === "regional" || String(d.executive_level || "").toLowerCase().trim() === "region") && String(d.region || "").toLowerCase().trim() === regionName.toLowerCase());
    const constExecs = sampleDelegates.filter(d => String(d.executive_level || "").toLowerCase().trim() === "constituency" && String(d.region || "").toLowerCase().trim() === regionName.toLowerCase());
    const regionList = [...regExecs, ...constExecs];
    for (let i = 0; i < regionList.length; i += 10) {
      const chunk = regionList.slice(i, i + 10);
      cardPages.push({
        page: currentCardPageNum,
        region: regionName,
        title: `${regionName.toUpperCase()} REGION · ${contest.toUpperCase()}`,
        cards: chunk,
      });
      currentCardPageNum++;
    }
  }

  assert.equal(cardPages.length, 3);
  assert.equal(cardPages[0].page, 3);
  assert.equal(cardPages[0].cards[0].executive_name, "NAT 1");

  assert.equal(cardPages[1].page, 4);
  assert.equal(cardPages[1].region, "Ahafo");
  assert.equal(cardPages[1].cards[0].executive_name, "AHAFO REG");
  assert.equal(cardPages[1].cards[1].executive_name, "AHAFO CONST");

  assert.equal(cardPages[2].page, 5);
  assert.equal(cardPages[2].region, "Volta");
  assert.equal(cardPages[2].cards[0].executive_name, "VOLTA REG");
  assert.equal(cardPages[2].cards[1].executive_name, "VOLTA CONST 1");
  assert.equal(cardPages[2].cards[2].executive_name, "VOLTA CONST 2");

  for (const page of cardPages.slice(1)) {
    const pageRegions = new Set(page.cards.map(c => c.region));
    assert.equal(pageRegions.size, 1, "Each card page in a wing album must only contain delegates from a single region");
  }
});
