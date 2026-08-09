import { apiError, getD1 } from "@/db/runtime";

export async function GET() {
  try {
    const db = getD1();
    const [regions, constituencies, electoralAreas, pollingStations] = await db.batch([
      db.prepare("SELECT id, name, code FROM regions ORDER BY name"),
      db.prepare("SELECT id, region_id AS regionId, name, code FROM constituencies ORDER BY name"),
      db.prepare("SELECT id, constituency_id AS constituencyId, name, code FROM electoral_areas ORDER BY name"),
      db.prepare("SELECT id, electoral_area_id AS electoralAreaId, name, code, address FROM polling_stations WHERE is_active = 1 ORDER BY name"),
    ]);
    return Response.json({
      regions: regions.results,
      constituencies: constituencies.results,
      electoralAreas: electoralAreas.results,
      pollingStations: pollingStations.results,
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, string>;
    const id = crypto.randomUUID();
    const name = body.name?.trim();
    const code = body.code?.trim().toUpperCase();
    if (!name || !body.type) return Response.json({ error: "Name and location type are required." }, { status: 400 });
    const db = getD1();
    if (body.type === "region") {
      if (!code) return Response.json({ error: "A region code is required." }, { status: 400 });
      await db.prepare("INSERT INTO regions (id, name, code) VALUES (?1, ?2, ?3)").bind(id, name, code).run();
    } else if (body.type === "constituency") {
      if (!body.parentId || !code) return Response.json({ error: "A parent region and code are required." }, { status: 400 });
      await db.prepare("INSERT INTO constituencies (id, region_id, name, code) VALUES (?1, ?2, ?3, ?4)").bind(id, body.parentId, name, code).run();
    } else if (body.type === "electoral_area") {
      if (!body.parentId) return Response.json({ error: "A parent constituency is required." }, { status: 400 });
      await db.prepare("INSERT INTO electoral_areas (id, constituency_id, name, code) VALUES (?1, ?2, ?3, ?4)").bind(id, body.parentId, name, code || null).run();
    } else if (body.type === "polling_station") {
      if (!body.parentId || !code) return Response.json({ error: "A parent electoral area and code are required." }, { status: 400 });
      await db.prepare("INSERT INTO polling_stations (id, electoral_area_id, name, code, address) VALUES (?1, ?2, ?3, ?4, ?5)").bind(id, body.parentId, name, code, body.address?.trim() || null).run();
    } else {
      return Response.json({ error: "Unsupported location type." }, { status: 400 });
    }
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
