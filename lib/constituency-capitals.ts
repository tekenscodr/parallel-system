/**
 * Canonical Constituency Capitals Mapping for Ghana 275 Electoral Geography
 * Maps constituency names to their official administrative/district capitals.
 */

function normalizeKey(str: string): string {
  return str
    .toUpperCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s*-\s*/g, "-");
}

export const CONSTITUENCY_CAPITALS: Record<string, string> = {
  // AHAFO REGION
  "ASUNAFO NORTH": "Goaso",
  "ASUNAFO SOUTH": "Kukuom",
  "ASUTIFI NORTH": "Kenyasi",
  "ASUTIFI SOUTH": "Hwidiem",
  "TANO NORTH": "Duayaw Nkwanta",
  "TANO SOUTH": "Bechem",

  // ASHANTI REGION
  "ADANSI ASOKWA": "Asokwa",
  "AFIGYA KWABRE NORTH": "Boamang",
  "AFIGYA KWABRE SOUTH": "Kodie",
  "AFIGYA SEYERE EAST": "Agona",
  "AHAFO ANO NORTH": "Tepa",
  "AHAFO ANO SOUTH WEST": "Mankranso",
  "AHAFO ANO SOUTH-EAST": "Dabaa",
  "AKROFUOM": "Akrofuom",
  "ASANTE AKIM CENTRAL": "Konongo",
  "ASANTE AKIM NORTH": "Agogo",
  "ASANTE AKIM SOUTH": "Juaso",
  "ASAWASE": "Asawase",
  "ASOKWA": "Asokwa",
  "ATWIMA KWANWOMA": "Twedie",
  "ATWIMA MPONUA": "Nyinahin",
  "ATWIMA NWABIAGYA NORTH": "Barekese",
  "ATWIMA NWABIAGYA SOUTH": "Nkawie",
  "BANTAMA": "Bantama",
  "BEKWAI": "Bekwai",
  "BOSOME FREHO": "Asiwa",
  "BOSOMTWE": "Kuntanase",
  "EFFIDUASE/ASOKORE": "Effiduase",
  "EJISU": "Ejisu",
  "EJURA SEKYEDUMASE": "Ejura",
  "FOMENA": "Fomena",
  "JUABEN": "Juaben",
  "KUMAWU": "Kumawu",
  "KWABRE EAST": "Mamponteng",
  "KWADASO MUNICIPAL": "Kwadaso",
  "MAMPONG": "Mampong",
  "MANHYIA NORTH": "Buokrom",
  "MANHYIA SOUTH": "Manhyia",
  "MANSO ADUBIA": "Adubia",
  "MANSO NKWANTA": "Manso Nkwanta",
  "NEW EDUBIASE": "New Edubiase",
  "NHYIAESO": "Nhyiaeso",
  "NSUTA/KWAMANG/BEPOSO": "Nsuta",
  "OBUASI EAST": "Tutuka",
  "OBUASI WEST": "Obuasi",
  "ODOTOBRI": "Jacobu",
  "OFFINSO NORTH": "Akomadan",
  "OFFINSO SOUTH": "Offinso",
  "OFORIKROM": "Oforikrom",
  "OLD TAFO": "Old Tafo",
  "SEKYERE AFRAM PLAINS": "Drobonso",
  "SUAME": "Suame",
  "SUBIN": "Kumasi",

  // GREATER ACCRA REGION
  "ABLEKUMA CENTRAL": "Lartebiokorshie",
  "ABLEKUMA NORTH": "Darkuman",
  "ABLEKUMA SOUTH": "Mamprobi",
  "ABLEKUMA WEST": "Dansoman",
  "ADA": "Ada Foah",
  "ADENTAN": "Adenta",
  "AMASAMAN": "Amasaman",
  "ANYAA/SOWUTUOM": "Sowutuom",
  "ASHAIMAN": "Ashaiman",
  "AYAWASO CENTRAL": "Kokomlemle",
  "AYAWASO EAST": "Nima",
  "AYAWASO NORTH": "Maamobi",
  "AYAWASO WEST WUOGON": "Dzorwulu",
  "BORTIANOR-NGLESHIE AMANFRO": "Bortianor",
  "DADEKOTOPON": "La",
  "DOME/KWABENYA": "Kwabenya",
  "DOMEABRA-OBOM": "Domeabra",
  "KORLE KLOTTEY": "Osu",
  "KPONE-KATAMANSO": "Kpone",
  "KROWOR": "Nungua",
  "LEDZOKUKU": "Teshie",
  "MADINA": "Madina",
  "NINGO PRAMPRAM": "Prampram",
  "ODODODIODIOO": "Jamestown",
  "OKAIKWEI CENTRAL": "Abeka",
  "OKAIKWEI NORTH": "Achimota",
  "OKAIKWEI SOUTH": "Kaneshie",
  "SEGE": "Sege",
  "SHAI-OSUDOKU": "Dodowa",
  "TEMA CENTRAL": "Tema Community 1",
  "TEMA EAST": "Tema Newtown",
  "TEMA WEST": "Tema Community 2",
  "TROBU": "Amasaman",
  "WEIJA-GBAWE": "Gbawe",

  // EASTERN REGION
  "ABIREM": "Abirem",
  "ABUAKWA NORTH": "Kukurantumi",
  "ABUAKWA SOUTH": "Kibi",
  "ACHIASE": "Achiase",
  "AFRAM PLAINS SOUTH": "Tease",
  "AKIM ODA": "Akim Oda",
  "AKIM SWEDRU": "Akim Swedru",
  "AKROPONG": "Akropong",
  "AKUAPEM SOUTH": "Aburi",
  "AKWATIA": "Akwatia",
  "ASENE/AKROSO/MANSO": "Manso",
  "ASUOGYAMAN": "Atimpoku",
  "ATIWA EAST": "Anyinam",
  "ATIWA WEST": "Kwabeng",
  "AYENSUANO": "Coaltar",
  "FANTEAKWA NORTH": "Begoro",
  "FANTEAKWA SOUTH": "Osino",
  "KADE": "Kade",
  "KWAHU AFRAM PLAINS NORTH": "Donkorkrom",
  "KWAHU EAST": "Abetifi",
  "LOWER MANYA KROBO": "Krobo Odumase",
  "LOWER WEST AKIM": "Asamankese",
  "MPRAESO": "Mpraeso",
  "NEW JUABEN NORTH": "Effiduase",
  "NEW JUABEN SOUTH": "Koforidua",
  "NKAWKAW": "Nkawkaw",
  "NSAWAM/ADOAGYIRI": "Nsawam",
  "OFOASE/AYIREBI": "Ofoase",
  "OKERE": "Adukrom",
  "SUHUM": "Suhum",
  "UPPER MANYA KROBO": "Asesewa",
  "UPPER WEST AKIM": "Adeiso",
  "YILO KROBO": "Somanya",

  // CENTRAL REGION
  "ABURA ASEBU KWAMANKESE": "Abura Dunkwa",
  "AGONA EAST": "Nsaba",
  "AGONA WEST": "Agona Swedru",
  "AJUMAKO ENYAN ESIAM": "Ajumako",
  "ASIKUMA/ODOBEN/BRAKWA": "Breman Asikuma",
  "ASSIN CENTRAL": "Assin Foso",
  "ASSIN NORTH": "Assin Bereku",
  "ASSIN SOUTH": "Nsuaem Kyekyewere",
  "AWUTU SENYA EAST": "Kasoa",
  "AWUTU SENYA WEST": "Awutu Breku",
  "CAPE COAST NORTH": "Cape Coast",
  "CAPE COAST SOUTH": "Cape Coast",
  "EFFUTU": "Winneba",
  "EKUMFI": "Essarkyir",
  "GOMOA CENTRAL": "Afransi",
  "GOMOA EAST": "Potsin",
  "GOMOA WEST": "Apam",
  "HEMANG LOWER DENKYIRA": "Twifo Hemang",
  "KOMENDA EDINA EGUAFO ABREM": "Elmina",
  "MFANTSEMAN": "Saltpond",
  "TWIFO ATTI MORKWA": "Twifo Praso",
  "UPPER DENKYIRA EAST": "Dunkwa-on-Offin",
  "UPPER DENKYIRA WEST": "Diaso",

  // WESTERN REGION
  "AHANTA WEST": "Agona Nkwanta",
  "AMENFI CENTRAL": "Manshyia",
  "AMENFI EAST": "Wassa Akropong",
  "AMENFI WEST": "Asankrangwa",
  "EFFIA": "Effia",
  "ELLEMBELE": "Nkroful",
  "ESSIKADU-KETAN": "Essikadu",
  "EVALUE AJOMORO GWIRA": "Axim",
  "JOMORO": "Half Assini",
  "KWESIMINTSIM": "Kwesimintsim",
  "MPOHOR": "Mpohor",
  "PRESTEA HUNI-VALLEY": "Bogoso",
  "SEKONDI": "Sekondi",
  "SHAMA": "Shama",
  "TAKORADI": "Takoradi",
  "TARKWA NSUAEM": "Tarkwa",
  "WASSA EAST": "Daboase",

  // WESTERN NORTH REGION
  "AOWIN": "Enchi",
  "BIA EAST": "Adabokrom",
  "BIA WEST": "Essam-Debiso",
  "BIBIANI-ANHWIASO-BEKWAI": "Bibiani",
  "BODI": "Bodi",
  "JUABOSO": "Juaboso",
  "SEFWI AKONTOMBRA": "Akontombra",
  "SEFWI WIAWSO": "Sefwi Wiawso",
  "SUAMAN": "Dadieso",

  // BONO REGION
  "BANDA": "Banda Ahenkro",
  "BEREKUM EAST": "Berekum",
  "BEREKUM WEST": "Jinijini",
  "DORMAA CENTRAL": "Dormaa Ahenkro",
  "DORMAA EAST": "Wamfie",
  "DORMAA WEST": "Nkrankwanta",
  "JAMAN NORTH": "Sampa",
  "JAMAN SOUTH": "Drobo",
  "SUNYANI EAST": "Sunyani",
  "SUNYANI WEST": "Odumase",
  "TAIN": "Nsawkaw",
  "WENCHI": "Wenchi",

  // BONO EAST REGION
  "ATEBUBU/AMANTIN": "Atebubu",
  "KINTAMPO NORTH": "Kintampo",
  "KINTAMPO SOUTH": "Jema",
  "NKORANZA NORTH": "Busunya",
  "NKORANZA SOUTH": "Nkoranza",
  "PRU EAST": "Yeji",
  "PRU WEST": "Prang",
  "SENE EAST": "Kajaji",
  "SENE WEST": "Kwame Danso",
  "TECHIMAN NORTH": "Tuobodom",
  "TECHIMAN SOUTH": "Techiman",

  // VOLTA REGION
  "ADAKLU": "Adaklu Waya",
  "AFADJATO SOUTH": "Ve Golokuati",
  "AGOTIME ZIOPE": "Kpetoe",
  "ANLO": "Anloga",
  "AKATSI NORTH": "Ave Dakpa",
  "AKATSI SOUTH": "Akatsi",
  "CENTRAL TONGU": "Adidome",
  "HO CENTRAL": "Ho",
  "HO WEST": "Dzolokpuita",
  "HOHOE": "Hohoe",
  "KETA": "Keta",
  "KETU NORTH": "Dzodze",
  "KETU SOUTH": "Denu",
  "KPANDO": "Kpando",
  "NORTH DAYI": "Anfoega",
  "NORTH TONGU": "Battor Dugame",
  "SOUTH DAYI": "Kpeve",
  "SOUTH TONGU": "Sogakope",

  // OTI REGION
  "BIAKOYE": "Nkonya Ahenkro",
  "BUEM": "Jasikan",
  "GUAN": "Likpe Mate",
  "KRACHI EAST": "Dambai",
  "KRACHI NCHUMURU": "Chinderi",
  "KRACHI WEST": "Kete Krachi",
  "NKWANTA NORTH": "Kpassa",
  "NKWANTA SOUTH": "Nkwanta",

  // NORTHERN REGION
  "BIMBILLA": "Bimbilla",
  "GUSHEGU": "Gushegu",
  "KARAGA": "Karaga",
  "KPANDAI": "Kpandai",
  "KUMBUNGU": "Kumbungu",
  "MION": "Sang",
  "NANTON": "Nanton",
  "SABOBA": "Saboba",
  "SAGNARIGU": "Sagnarigu",
  "SAVELUGU": "Savelugu",
  "TAMALE CENTRAL": "Tamale",
  "TAMALE NORTH": "Tamale",
  "TAMALE SOUTH": "Tamale",
  "TATALE/SANGULI": "Tatale",
  "TOLON": "Tolon",
  "WULESNSI": "Wulensi",
  "YENDI": "Yendi",
  "ZABZUGU": "Zabzugu",

  // NORTH EAST REGION
  "BUNKPURUGU": "Bunkpurugu",
  "CHERE PONI": "Chereponi",
  "CHEREPONI": "Chereponi",
  "NALERIGU/GAMBAGA": "Nalerigu",
  "WALEWALE": "Walewale",
  "YAGABA/ KUBORI": "Yagaba",
  "YUNYOO": "Yunyoo",

  // SAVANNAH REGION
  "BOLE-BAMBOI": "Bole",
  "DABOYA/MANKARIGU": "Daboya",
  "DAMONGO": "Damongo",
  "SALAGA NORTH": "Kpalbe",
  "SALAGA SOUTH": "Salaga",
  "SAWLA-TUNA-KALBA": "Sawla",
  "YAPEI/KUSAWGU": "Yapei",

  // UPPER EAST REGION
  "BAWKU CENTRAL": "Bawku",
  "BINDURI": "Binduri",
  "BOLGA EAST": "Zuarungu",
  "BOLGATANGA CENTRAL": "Bolgatanga",
  "BONGO": "Bongo",
  "BUILSA NORTH": "Sandema",
  "BUILSA SOUTH": "Fumbisi",
  "CHIANA-PAGA": "Paga",
  "GARU": "Garu",
  "NABDAM": "Nangodi",
  "NAVRONGO CENTRAL": "Navrongo",
  "PUSIGA": "Pusiga",
  "TALENSI": "Tongo",
  "TEMPANE": "Tempane",
  "ZEBILLA": "Zebilla",

  // UPPER WEST REGION
  "DAFFIAMA/BUSSIE/ISSA": "Issa",
  "JIRAPA": "Jirapa",
  "LAMBUSSIE": "Lambussie",
  "LAWRA": "Lawra",
  "NADOWLI/KALEO": "Nadowli",
  "NANDOM": "Nandom",
  "SISSALA EAST": "Tumu",
  "SISSALA WEST": "Gwollu",
  "WA CENTRAL": "Wa",
  "WA EAST": "Funsi",
  "WA WEST": "Wechiau",
};

/**
 * Resolves the official capital for a given constituency name.
 * Normalizes name formatting before lookup and provides a clean fallback.
 */
export function getConstituencyCapital(constituencyName: string | null | undefined): string {
  if (!constituencyName) return "Capital Headquarters";
  const raw = String(constituencyName).trim();
  const upper = raw.toUpperCase();

  // 1. Direct match
  if (CONSTITUENCY_CAPITALS[upper]) {
    return CONSTITUENCY_CAPITALS[upper];
  }

  // 2. Normalized match
  const norm = normalizeKey(raw);
  if (CONSTITUENCY_CAPITALS[norm]) {
    return CONSTITUENCY_CAPITALS[norm];
  }

  // 3. Fallback: clean title casing
  return raw
    .split(/[\s/]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
