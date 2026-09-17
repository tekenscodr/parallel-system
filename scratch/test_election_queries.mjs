
import { GET } from "../app/api/admin/albums/election/route.ts";

const contests = [
  "National Chairperson & General Officers",
  "Youth Organisers & Deputies",
  "Women Organisers & Deputies",
  "Nasara Coordinators & Deputies",
  "Chairperson",
  "Youth Organiser",
  "Women Organiser",
  "Nasara Organiser",
  "General Secretary",
  "Treasurer",
  "Organiser",
  "Communication Officer",
  "Vice Chairperson"
];

const regions = [
  "all",
  "Ashanti", "Eastern", "Greater Accra", "Central", "Ahafo", "Western", 
  "Northern", "Volta", "Bono", "Bono East", "Upper East", "Upper West", 
  "Oti", "Savannah", "North East", "Western North", "External Branch"
];

const levels = ["all", "constituency", "regional", "tescon"];

console.log("Testing combinations...");

for (const contest of contests) {
  for (const region of regions) {
    for (const level of levels) {
      try {
        const url = new URL("http://localhost:3000/api/admin/albums/election");
        url.searchParams.set("contest", contest);
        url.searchParams.set("region", region);
        if (level !== "all") url.searchParams.set("level", level);

        const req = new Request(url.toString(), {
          headers: {
            // we will simulate admin session in route or test
          }
        });

      } catch (e) {
      }
    }
  }
}
