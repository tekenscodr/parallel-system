export const WING_PORTFOLIOS = [
  "Youth Organisers & Deputies",
  "Women Organisers & Deputies",
  "Nasara Coordinators & Deputies",
] as const;

export const GENERAL_CONTEST_LIST = [
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

export const CONTEST_LIST = [
  ...WING_PORTFOLIOS,
  ...GENERAL_CONTEST_LIST,
] as const;

export type ContestType = (typeof CONTEST_LIST)[number];

