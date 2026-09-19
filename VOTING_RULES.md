# NPP National Position Voting Rules & Electoral College Guidelines (2026)

**Source:** Authoritative National Elections Committee application rules for the 2026 Internal Elections and Album Publication system.

---

## 1. Contests & Electorate Eligibility Rules

The internal national elections cover nine (9) specific elective executive portfolios. Electorates are drawn strictly from four recognized tiers: **National**, **Regional**, **Constituency** (including overseas **External Branch** chapters), and **TESCON** (where authorized). External Branch executives hold **Constituency level** status and are fully incorporated into the Electoral College, voting for all national positions following the rules of constituency level.

> [!IMPORTANT]
> **Strict Exclusion of TESCON Patrons:** TESCON Patrons do not hold voting delegate status in any contest and are strictly excluded from all electoral college registers and album rolls.

| Position / Contest | Eligible Electorate Composition | Excluded Entities |
| :--- | :--- | :--- |
| **Chairperson** | All certified National, Regional, and Constituency (including External Branch) executives, plus all substantive **TESCON Presidents**. | Polling Station, Electoral Area, TESCON Patrons, Non-executive members. |
| **Vice Chairperson** | Same electorate as National Chairperson. | Same as National Chairperson. |
| **General Secretary** | Same electorate as National Chairperson. | Same as National Chairperson. |
| **Treasurer** | Same electorate as National Chairperson. | Same as National Chairperson. |
| **Communication Officer** | Same electorate as National Chairperson. | Same as National Chairperson. |
| **Organiser** | Same electorate as National Chairperson. | Same as National Chairperson. |
| **Youth Organiser** | 1. All executives across **Constituency** (including External Branch), **Regional**, and **National** levels aged **under 40** (evaluated using exact date of birth with a fixed statutory cutoff as at **21st August, 2026**; e.g. anyone born after 21st August 1986 qualifies as under 40).<br>2. **Youth Organisers and Deputy Youth Organisers** across all levels (ex-officio, regardless of DOB availability).<br>3. **TESCON Presidents** (regardless of age).<br>4. **TESCON Women Commissioners (WOCOM)** (regardless of age).<br>5. **TESCON Nasara Coordinators** (regardless of age).<br>6. Any other confirmed executive in the authorized levels aged under 40. | Core executives aged 40 and above (unless holding ex-officio youth portfolio), Former National Youth Organisers, Former officers, TESCON Patrons, Polling Station / Electoral Area executives. |
| **Women Organiser** | 1. All **female** executives in the electoral college at **National**, **Regional**, and **Constituency** (including External Branch) levels.<br>2. All **TESCON Women Commissioners (WOCOM)**.<br>3. All **Female TESCON Presidents**.<br>4. All **Female TESCON Nasara Coordinators**. | All male executives, TESCON Patrons, Polling Station / Electoral Area executives. |
| **Nasara Organiser** | 1. All **Nasara executives** across **National**, **Regional**, and **Constituency** (including External Branch) levels (substantive Nasara Coordinators / Organisers and Deputy Nasara Coordinators / Organisers).<br>2. All **TESCON Nasara Coordinators**. | Non-Nasara portfolio holders, TESCON Patrons, Polling Station / Electoral Area executives. |

---

## 2. The Two-Stage Album Hierarchy

Every official Election Album and Voter Directory must be organized strictly according to a **2-Stage Hierarchy**:

```
┌─────────────────────────────────────────────────────────────┐
│                 STAGE 1: THE LEVEL HIERARCHY                │
│                                                             │
│   1. National Level                                         │
│   2. Regional Level (Alphabetical by Region)                │
│   3. Constituency Level (By Region, Alphabetical)           │
│   4. TESCON Level (By Institution / Region, if applicable)  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│             STAGE 2: THE POSITIONAL HIERARCHY               │
│               (Applied within each Level)                   │
│                                                             │
│   1. Chairperson / Chairman                                 │
│   2. 1st Vice Chairperson / 1st Vice Chairman               │
│   3. 2nd Vice Chairperson / 2nd Vice Chairman               │
│   4. Secretary / General Secretary                          │
│   5. Deputy Secretary / Assistant Secretary                 │
│   6. Treasurer                                              │
│   7. Organiser                                              │
│   8. Women Organiser                                        │
│   9. Youth Organiser                                        │
│  10. Nasara Organiser / Coordinator                         │
│  11. Financial Secretary                                    │
│  12. Electoral Affairs Officer                              │
│  13. Communication Officer / Communications Officer         │
│  14. Research Officer                                       │
│  15. PWD Officer / Coordinator                              │
│  16. Deputy Organiser                                       │
│  17. Deputy Women Organiser                                 │
│  18. Deputy Youth Organiser                                 │
│  19. Deputy Nasara Organiser / Coordinator                  │
│  20. Special Duties Officer                                 │
│  21. Legal Representative Officer                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Album Design & Publication Specifications

Album publications follow the verified **NPP Ahafo Region Election Album layout**:

1. **Cover & Certification (Page 1)**:
   - **Design Integrity**: Preserves the Ahafo official cover architecture (double border in party blue `#003399`, party tricolor bar in red/white/blue, top NPP logo, official certified seal, and signature block of Hon. Opare Ansah, National Elections Committee Chairman).
   - **Designation**: All albums generated prior to final certification gazetting are designated **Provisional Album**.
   - **Contest Badge**: Dynamically indicates the contest (e.g., `NATIONAL YOUTH ORGANISER ELECTION · 2026`).

2. **Executive Summary & Electorate Metrics (Page 2)**:
   - **Expected vs. Actual Figures**:
     - *Expected Figures*: The statutory total of authorized seats for the election scope.
     - *Actual Figures*: The verified count of currently gazetted, non-vacant executives eligible to vote.
     - *Variance / Vacancies*: Exact delta of seats pending gazetting or reconciliation.
   - **Breakdown by Level**: National, Regional, Constituency, and TESCON seat allocations.
   - **Demographic Breakdown**: Gender ratio (Male / Female) and Age distribution (Under 40 vs. 40+).
   - **Quorum Requirement**: Statutory quorum figure required for election validity under Article 17.

3. **Electorate Directory (Pages 3 to N-1)**:
   - Formatted in A4 standard portrait (`210mm x 297mm`).
   - Profile cards display: Canonical Position Badge, Full Name, Biometric Voter ID, Phone Contact, and Photograph.
   - For missing or 0-byte photos, a high-contrast SVG avatar badge featuring the delegate's initials and party branding is rendered.

4. **Deep-Dive Statistics & Quorum Analysis (Final Page)**:
   - Comprehensive regional distribution matrix.
   - Constituency-level compliance breakdown.
   - Formal gazette seal and verification timestamp.

---

## 4. Counting & Integrity Rules

* **Authoritative Source**: Records are queried directly from the `executives_all` table in the PostgreSQL `ec-data` database.
* **Vacancies**: Unfilled seats, placeholders, and records marked `vacant`, `vacancy`, or `unknown` are omitted from the voter roll and flagged under variance metrics.
* **Age Calculation**: Calculated strictly as $\text{Age} = 2026 - \text{Year of Birth}$. Age fields in database records are cross-checked against recorded date of birth.
* **Gender Integrity**: Gender is determined strictly from authoritative recorded metadata (`Male` or `Female`), never inferred from names or photos.
* **Single Electorate Representation**: Each delegate is listed once per contest album.
