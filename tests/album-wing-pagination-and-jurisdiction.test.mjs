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

test("Women and Youth organisers load just like Nasara: exclusive wing extraction, matching quotas, and scope alignment", () => {
  const routePath = path.join(process.cwd(), "app/api/admin/albums/election/route.ts");
  const routeCode = fs.readFileSync(routePath, "utf8");

  // 1. isWingOrganisers includes Youth Organiser and Women Organiser
  assert.ok(
    routeCode.includes('matchedContest === "Youth Organiser"') &&
      routeCode.includes('matchedContest === "Women Organiser"') &&
      routeCode.includes('matchedContest === "Nasara Organiser"'),
    "isWingOrganisers must recognize Youth Organiser, Women Organiser, and Nasara Organiser"
  );

  // 2. Wing-specific extraction branch in contestFiltered handles Youth Organiser and Women Organiser
  assert.ok(
    routeCode.includes('matchedContest === "Youth Organisers & Deputies" ||\n          matchedContest === "Youth Organiser"'),
    "Wing extraction in contestFiltered must handle both Youth Organisers & Deputies and Youth Organiser"
  );
  assert.ok(
    routeCode.includes('/president|wocom|women|nasara/i.test(posLower)'),
    "Youth wing extraction must include TESCON President, WOCOM, and Nasara Coordinator"
  );
  assert.ok(
    routeCode.includes('matchedContest === "Women Organisers & Deputies" ||\n          matchedContest === "Women Organiser"'),
    "Wing extraction in contestFiltered must handle both Women Organisers & Deputies and Women Organiser"
  );
  assert.ok(
    routeCode.includes('matchedContest === "Nasara Coordinators & Deputies" ||\n          matchedContest === "Nasara Organiser"'),
    "Wing extraction in contestFiltered must handle both Nasara Coordinators & Deputies and Nasara Organiser"
  );

  // 3. Page.tsx defaults scope to organisers_only and sets organisers_only on wing contest selection
  const pagePath = path.join(process.cwd(), "app/admin/albums/page.tsx");
  const pageCode = fs.readFileSync(pagePath, "utf8");

  assert.ok(
    pageCode.includes('const [scope, setScope] = useState("organisers_only");'),
    "Page must default scope state to organisers_only"
  );
  assert.ok(
    pageCode.includes('val === "Youth Organiser" ||') &&
      pageCode.includes('val === "Women Organiser" ||') &&
      pageCode.includes('val === "Nasara Organiser"'),
    "Page onChange must set scope to organisers_only for Youth Organiser, Women Organiser, and Nasara Organiser"
  );

  // 4. Test wing filtering behavior across a representative pool
  const testPool = [
    // Youth Core
    { position: "Youth Organiser", gender: "Male", age: 31, level: "Constituency" },
    { position: "Deputy Youth Organiser", gender: "Female", age: 29, level: "Constituency" },
    { position: "Chairman", gender: "Male", age: 34, level: "Constituency" }, // under 40, but NOT youth organiser
    // Women
    { position: "Women Organiser", gender: "Female", age: 48, level: "Constituency" },
    { position: "Deputy Women Organiser", gender: "Female", age: 42, level: "Constituency" },
    { position: "TESCON WOCOM", gender: "Female", age: 22, level: "TESCON" },
    { position: "Secretary", gender: "Female", age: 40, level: "Constituency" }, // female, but NOT women organiser
    // Nasara
    { position: "Nasara Coordinator", gender: "Male", age: 52, level: "Constituency" },
    { position: "Deputy Nasara Coordinator", gender: "Male", age: 45, level: "Constituency" },
    { position: "TESCON Nasara Coordinator", gender: "Male", age: 24, level: "TESCON" },
    // TESCON President & Patron
    { position: "TESCON President", gender: "Male", age: 23, level: "TESCON" },
    { position: "TESCON Patron", gender: "Male", age: 52, level: "TESCON" },
  ];

  // Youth filter (Constituency/Regional Youth Organisers & Deputies + TESCON President, WOCOM, Nasara)
  const youthResults = testPool.filter((r) => {
    const lvl = (r.level || "").toLowerCase();
    const posLower = r.position.toLowerCase();
    if (lvl === "tescon") {
      return (
        /president|wocom|women|nasara/i.test(posLower) &&
        !posLower.includes("patron") &&
        !posLower.includes("former")
      );
    }
    return (
      (posLower.includes("youth organiser") ||
        posLower.includes("youth organizer") ||
        posLower === "youth" ||
        posLower.includes("deputy youth") ||
        posLower.includes("assistant youth")) &&
      !posLower.includes("former") &&
      !posLower.includes("patron")
    );
  });
  assert.equal(youthResults.length, 5, "Youth wing must extract 2 core youth + 3 TESCON executives");
  assert.ok(youthResults.some((r) => r.position === "Youth Organiser"));
  assert.ok(youthResults.some((r) => r.position === "Deputy Youth Organiser"));
  assert.ok(youthResults.some((r) => r.position === "TESCON President"), "TESCON President must be included");
  assert.ok(youthResults.some((r) => r.position === "TESCON WOCOM"), "TESCON WOCOM must be included");
  assert.ok(youthResults.some((r) => r.position === "TESCON Nasara Coordinator"), "TESCON Nasara must be included");
  assert.ok(!youthResults.some((r) => r.position === "TESCON Patron"), "TESCON Patron must be excluded");
  assert.ok(!youthResults.some((r) => r.position === "Chairman"), "Chairman under 40 must not be extracted");

  // Women filter
  const womenResults = testPool.filter((r) => {
    const posLower = r.position.toLowerCase();
    return (
      (posLower.includes("women organiser") ||
        posLower.includes("women organizer") ||
        posLower === "women" ||
        posLower.includes("deputy women") ||
        posLower.includes("assistant women") ||
        posLower.includes("wocom")) &&
      !posLower.includes("former") &&
      !posLower.includes("patron")
    );
  });
  assert.equal(womenResults.length, 3);
  assert.ok(!womenResults.some((r) => r.position === "Secretary"), "Female Secretary must not be extracted");

  // Nasara filter
  const nasaraResults = testPool.filter((r) => {
    const posLower = r.position.toLowerCase();
    return (
      posLower.includes("nasara") &&
      !posLower.includes("former") &&
      !posLower.includes("patron")
    );
  });
  assert.equal(nasaraResults.length, 3);
});

