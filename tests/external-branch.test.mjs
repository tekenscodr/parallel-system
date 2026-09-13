import assert from "node:assert/strict";
import test from "node:test";
import {
  EXTERNAL_BRANCH_COUNTRIES,
  getConstituenciesForRegion,
  normalizeConstituency,
  isValidConstituency,
} from "../lib/constituency-normalizer.ts";
import { computeExecutiveAgeAndDob } from "../lib/voting-rules.ts";

const EXPECTED_30_COUNTRIES = [
  "Senegal",
  "Russia",
  "United Kingdom",
  "Middle East",
  "Togo",
  "Nigeria",
  "South Africa",
  "United States of America",
  "Austria",
  "Spain",
  "Sweden",
  "Australia",
  "Hong Kong",
  "Qatar",
  "Norway",
  "South Korea",
  "Ireland",
  "Italy",
  "Ivory Coast",
  "Japan",
  "Netherland",
  "China",
  "Czech",
  "Denmark",
  "Equitorial Guinea",
  "Germany",
  "France",
  "Finland",
  "Belgium",
  "Canada",
];

test("EXTERNAL_BRANCH_COUNTRIES contains the exact 30 specified countries", () => {
  assert.equal(EXTERNAL_BRANCH_COUNTRIES.length, 30);
  for (const country of EXPECTED_30_COUNTRIES) {
    assert.ok(
      EXTERNAL_BRANCH_COUNTRIES.includes(country),
      `Expected country ${country} to be present in EXTERNAL_BRANCH_COUNTRIES`
    );
  }
});

test("getConstituenciesForRegion returns 30 countries for External Branch", () => {
  const result = getConstituenciesForRegion("External Branch");
  assert.equal(result.length, 30);

  const lowerResult = getConstituenciesForRegion("external branch");
  assert.equal(lowerResult.length, 30);

  const aliasResult = getConstituenciesForRegion("external");
  assert.equal(aliasResult.length, 30);

  const pluralResult = getConstituenciesForRegion("external branches");
  assert.equal(pluralResult.length, 30);
});

test("normalizeConstituency normalizes country names and handles aliases", () => {
  // Exact matches
  for (const country of EXPECTED_30_COUNTRIES) {
    assert.equal(normalizeConstituency(country), country);
    assert.equal(normalizeConstituency(country.toLowerCase()), country);
    assert.equal(normalizeConstituency(country.toUpperCase()), country);
    assert.ok(isValidConstituency(country));
  }

  // Aliases
  assert.equal(normalizeConstituency("UK"), "United Kingdom");
  assert.equal(normalizeConstituency("USA"), "United States of America");
  assert.equal(normalizeConstituency("U.S.A."), "United States of America");
  assert.equal(normalizeConstituency("Netherlands"), "Netherland");
  assert.equal(normalizeConstituency("Czech Republic"), "Czech");
  assert.equal(normalizeConstituency("Equatorial Guinea"), "Equitorial Guinea");
  assert.equal(normalizeConstituency("Cote d'Ivoire"), "Ivory Coast");
  assert.equal(normalizeConstituency("Côte d'Ivoire"), "Ivory Coast");
  assert.equal(normalizeConstituency("Korea"), "South Korea");
  assert.equal(normalizeConstituency("Republic of Korea"), "South Korea");
});

test("computeExecutiveAgeAndDob does NOT reduce age > 40 for External Branch executives", () => {
  // External branch by executiveLevel
  const res1 = computeExecutiveAgeAndDob(
    "1978-05-12",
    "Youth Organiser",
    "External Branch",
    "United Kingdom"
  );
  assert.equal(res1.age, 48, "External branch age 48 must not be reduced");
  assert.equal(res1.dob, "1978-05-12", "External branch DOB year must remain 1978");

  // External branch by region
  const res2 = computeExecutiveAgeAndDob(
    "1970-11-20",
    "Deputy Youth Organiser",
    "Constituency",
    "External Branch"
  );
  assert.equal(res2.age, 56, "External branch age 56 must not be reduced");
  assert.equal(res2.dob, "1970-11-20", "External branch DOB year must remain 1970");

  // External branch non-youth position
  const res3 = computeExecutiveAgeAndDob(
    "1975-01-01",
    "Chairman",
    "External Branch",
    "External Branch"
  );
  assert.equal(res3.age, 51);
  assert.equal(res3.dob, "1975-01-01");

  // Standard domestic constituency youth organiser > 39 DOES get reduced
  const res4 = computeExecutiveAgeAndDob(
    "1978-05-12",
    "Youth Organiser",
    "Constituency",
    "Greater Accra"
  );
  assert.equal(res4.age, 39, "Standard youth age > 39 must be capped at 39");
  assert.equal(res4.dob, "1987-05-12", "Standard youth DOB year must be adjusted to 1987");
});

