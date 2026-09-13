export const CONTEST_LIST = [
  "Chairperson",
  "Vice Chairperson",
  "General Secretary",
  "Treasurer",
  "Communication Officer",
  "Organiser",
  "Youth Organiser",
  "Women Organiser",
  "Nasara Organiser",
] as const;

export type ContestType = (typeof CONTEST_LIST)[number];
