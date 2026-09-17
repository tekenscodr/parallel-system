import crypto from "node:crypto";
import { withEcSql } from "./db-ec";

export interface MediaAccreditationInput {
  category?: string;
  name: string;
  gender: string;
  company: string;
  roleTitle?: string | null;
  assignedZone?: string | null;
  serviceNumber?: string | null;
  emergencyContact?: string | null;
  region: string;
  street: string;
  ghanaPostAddress: string;
  idType: string;
  idNumber: string;
  profileImage?: string | null;
  phone?: string | null;
  email?: string | null;
  voterId?: string | null;
}

export interface MediaAccreditationResult {
  id: string;
  category: string;
  name: string;
  gender: string;
  company: string;
  roleTitle?: string | null;
  assignedZone?: string | null;
  serviceNumber?: string | null;
  emergencyContact?: string | null;
  region: string;
  street: string;
  ghanaPostAddress: string;
  idType: string;
  idNumber: string;
  voterId?: string | null;
  profileImage?: string | null;
  phone?: string | null;
  email?: string | null;
  status: string;
  accreditationCode: string;
  qrCodeData?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: Date | string | null;
  notes?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

declare global {
  // eslint-disable-next-line no-var
  var _mediaAccreditationStore: Map<string, MediaAccreditationResult> | undefined;
}

// In-memory cache for graceful fallback, unit tests, and cross-module consistency
const inMemoryStore: Map<string, MediaAccreditationResult> =
  globalThis._mediaAccreditationStore || new Map<string, MediaAccreditationResult>();
globalThis._mediaAccreditationStore = inMemoryStore;

let tableInitialized = false;

/**
 * Ensure the media_accreditations table exists in PostgreSQL.
 * Matches exact schema from npp-website project.
 */
export async function ensureMediaAccreditationTableExists(): Promise<void> {
  if (tableInitialized) return;
  try {
    await withEcSql(async (sql) => {
      await sql`
        CREATE TABLE IF NOT EXISTS media_accreditations (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          category TEXT NOT NULL DEFAULT 'MEDIA',
          name TEXT NOT NULL,
          gender TEXT NOT NULL,
          company TEXT NOT NULL,
          "roleTitle" TEXT,
          "assignedZone" TEXT,
          "serviceNumber" TEXT,
          "emergencyContact" TEXT,
          region TEXT NOT NULL,
          street TEXT NOT NULL,
          "ghanaPostAddress" TEXT NOT NULL,
          "idType" TEXT NOT NULL,
          "idNumber" TEXT NOT NULL,
          "voterId" TEXT,
          "profileImage" TEXT,
          phone TEXT,
          email TEXT,
          status TEXT NOT NULL DEFAULT 'PENDING',
          "accreditationCode" TEXT UNIQUE NOT NULL,
          "qrCodeData" TEXT,
          "reviewedBy" TEXT,
          "reviewedAt" TIMESTAMP WITH TIME ZONE,
          notes TEXT,
          "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT media_accreditations_id_type_number_unique UNIQUE ("idType", "idNumber")
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_media_accreditations_category ON media_accreditations(category)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_media_accreditations_company ON media_accreditations(company)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_media_accreditations_status ON media_accreditations(status)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_media_accreditations_region ON media_accreditations(region)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_media_accreditations_code ON media_accreditations("accreditationCode")
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_media_accreditations_voter_id ON media_accreditations("voterId")
      `;
    });
    tableInitialized = true;
  } catch (err: any) {
    console.warn("[MEDIA ACCREDITATION] Using resilient memory store:", err.message);
  }
}

export class MediaAccreditationService {
  /**
   * Generates a category-specific Accreditation Code:
   * - MEDIA:    MED-2026-XXXXXX
   * - SECURITY: SEC-2026-XXXXXX
   * - USHER:    USH-2026-XXXXXX
   */
  public generateAccreditationCode(category: string = "MEDIA"): string {
    const randomPart = crypto.randomBytes(3).toString("hex").toUpperCase();
    const upperCat = category.toUpperCase();

    let prefix = "MED";
    if (upperCat === "SECURITY") {
      prefix = "SEC";
    } else if (upperCat === "USHER") {
      prefix = "USH";
    }

    return `${prefix}-2026-${randomPart}`;
  }

  /**
   * Cleans and normalizes identification number
   */
  public normalizeId(id: string): string {
    return id.trim().toUpperCase().replace(/\s+/g, "");
  }

  /**
   * Submits a new accreditation request or retrieves existing one if already submitted
   */
  async submitAccreditation(input: MediaAccreditationInput): Promise<{
    isExisting: boolean;
    accreditation: MediaAccreditationResult;
  }> {
    const normalizedId = this.normalizeId(input.idNumber);
    const normalizedIdType = input.idType.trim().toLowerCase();
    const compositeKey = `${normalizedIdType}:${normalizedId}`;
    const resolvedCategory = (input.category || "MEDIA").toUpperCase();

    const resolvedVoterId =
      input.voterId?.trim() ||
      (normalizedIdType === "voter-id" ? normalizedId : null);

    try {
      await ensureMediaAccreditationTableExists();

      // 1. Check if record already exists in database
      const existingRows = await withEcSql(async (sql) => {
        return await sql<MediaAccreditationResult[]>`
          SELECT 
            id,
            category,
            name,
            gender,
            company,
            "roleTitle",
            "assignedZone",
            "serviceNumber",
            "emergencyContact",
            region,
            street,
            "ghanaPostAddress",
            "idType",
            "idNumber",
            "voterId",
            "profileImage",
            phone,
            email,
            status,
            "accreditationCode",
            "qrCodeData",
            "reviewedBy",
            "reviewedAt",
            notes,
            "createdAt",
            "updatedAt"
          FROM media_accreditations
          WHERE "idType" = ${normalizedIdType} AND "idNumber" = ${normalizedId}
          LIMIT 1
        `;
      });

      if (existingRows && existingRows.length > 0) {
        const existing = existingRows[0];
        inMemoryStore.set(compositeKey, existing);
        inMemoryStore.set(existing.accreditationCode, existing);
        return {
          isExisting: true,
          accreditation: existing,
        };
      }

      // 2. Generate new accreditation code and insert
      const accreditationCode = this.generateAccreditationCode(resolvedCategory);
      const generatedId = `cuid-${crypto.randomBytes(8).toString("hex")}`;

      const now = new Date();
      const insertedRows = await withEcSql(async (sql) => {
        return await sql<MediaAccreditationResult[]>`
          INSERT INTO media_accreditations (
            id,
            category,
            name,
            gender,
            company,
            "roleTitle",
            "assignedZone",
            "serviceNumber",
            "emergencyContact",
            region,
            street,
            "ghanaPostAddress",
            "idType",
            "idNumber",
            "voterId",
            "profileImage",
            phone,
            email,
            status,
            "accreditationCode",
            "createdAt",
            "updatedAt"
          ) VALUES (
            ${generatedId},
            ${resolvedCategory},
            ${input.name.trim()},
            ${input.gender.trim()},
            ${input.company.trim()},
            ${input.roleTitle?.trim() || null},
            ${input.assignedZone?.trim() || null},
            ${input.serviceNumber?.trim() || null},
            ${input.emergencyContact?.trim() || null},
            ${input.region.trim()},
            ${input.street.trim()},
            ${input.ghanaPostAddress.trim().toUpperCase()},
            ${normalizedIdType},
            ${normalizedId},
            ${resolvedVoterId},
            ${input.profileImage || null},
            ${input.phone?.trim() || null},
            ${input.email?.trim() || null},
            'PENDING',
            ${accreditationCode},
            ${now},
            ${now}
          )
          RETURNING 
            id,
            category,
            name,
            gender,
            company,
            "roleTitle",
            "assignedZone",
            "serviceNumber",
            "emergencyContact",
            region,
            street,
            "ghanaPostAddress",
            "idType",
            "idNumber",
            "voterId",
            "profileImage",
            phone,
            email,
            status,
            "accreditationCode",
            "qrCodeData",
            "reviewedBy",
            "reviewedAt",
            notes,
            "createdAt",
            "updatedAt"
        `;
      });

      const created = insertedRows[0];
      inMemoryStore.set(compositeKey, created);
      inMemoryStore.set(accreditationCode, created);

      return {
        isExisting: false,
        accreditation: created,
      };
    } catch (dbError: any) {
      console.warn("[MEDIA ACCREDITATION] DB error, using fallback cache:", dbError.message);

      const cached = inMemoryStore.get(compositeKey);
      if (cached) {
        return { isExisting: true, accreditation: cached };
      }

      const accreditationCode = this.generateAccreditationCode(resolvedCategory);
      const fallbackRecord: MediaAccreditationResult = {
        id: `local-${Date.now()}`,
        category: resolvedCategory,
        name: input.name.trim(),
        gender: input.gender.trim(),
        company: input.company.trim(),
        roleTitle: input.roleTitle?.trim() || null,
        assignedZone: input.assignedZone?.trim() || null,
        serviceNumber: input.serviceNumber?.trim() || null,
        emergencyContact: input.emergencyContact?.trim() || null,
        region: input.region.trim(),
        street: input.street.trim(),
        ghanaPostAddress: input.ghanaPostAddress.trim().toUpperCase(),
        idType: normalizedIdType,
        idNumber: normalizedId,
        voterId: resolvedVoterId,
        profileImage: input.profileImage || null,
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null,
        status: "PENDING",
        accreditationCode,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      inMemoryStore.set(compositeKey, fallbackRecord);
      inMemoryStore.set(accreditationCode, fallbackRecord);

      return {
        isExisting: false,
        accreditation: fallbackRecord,
      };
    }
  }

  /**
   * Retrieves an accreditation by ID number, code, or voter ID
   */
  async getAccreditation(query: {
    idNumber?: string;
    idType?: string;
    code?: string;
    voterId?: string;
    category?: string;
  }): Promise<MediaAccreditationResult | null> {
    const { idNumber, idType, code, voterId, category } = query;

    try {
      await ensureMediaAccreditationTableExists();

      if (code) {
        const cleanCode = code.trim().toUpperCase();
        const rows = await withEcSql(async (sql) => {
          return await sql<MediaAccreditationResult[]>`
            SELECT 
              id, category, name, gender, company, "roleTitle", "assignedZone",
              "serviceNumber", "emergencyContact", region, street, "ghanaPostAddress",
              "idType", "idNumber", "voterId", "profileImage", phone, email, status,
              "accreditationCode", "qrCodeData", "reviewedBy", "reviewedAt", notes,
              "createdAt", "updatedAt"
            FROM media_accreditations
            WHERE UPPER("accreditationCode") = ${cleanCode}
            LIMIT 1
          `;
        });
        if (rows && rows.length > 0) return rows[0];
      }

      if (voterId) {
        const cleanVoterId = voterId.trim();
        const rows = await withEcSql(async (sql) => {
          return await sql<MediaAccreditationResult[]>`
            SELECT 
              id, category, name, gender, company, "roleTitle", "assignedZone",
              "serviceNumber", "emergencyContact", region, street, "ghanaPostAddress",
              "idType", "idNumber", "voterId", "profileImage", phone, email, status,
              "accreditationCode", "qrCodeData", "reviewedBy", "reviewedAt", notes,
              "createdAt", "updatedAt"
            FROM media_accreditations
            WHERE "voterId" = ${cleanVoterId}
            LIMIT 1
          `;
        });
        if (rows && rows.length > 0) return rows[0];
      }

      if (idNumber) {
        const normalizedId = this.normalizeId(idNumber);
        const rows = await withEcSql(async (sql) => {
          if (idType) {
            const normalizedIdType = idType.trim().toLowerCase();
            return await sql<MediaAccreditationResult[]>`
              SELECT 
                id, category, name, gender, company, "roleTitle", "assignedZone",
                "serviceNumber", "emergencyContact", region, street, "ghanaPostAddress",
                "idType", "idNumber", "voterId", "profileImage", phone, email, status,
                "accreditationCode", "qrCodeData", "reviewedBy", "reviewedAt", notes,
                "createdAt", "updatedAt"
              FROM media_accreditations
              WHERE "idType" = ${normalizedIdType} AND "idNumber" = ${normalizedId}
              LIMIT 1
            `;
          } else if (category) {
            return await sql<MediaAccreditationResult[]>`
              SELECT 
                id, category, name, gender, company, "roleTitle", "assignedZone",
                "serviceNumber", "emergencyContact", region, street, "ghanaPostAddress",
                "idType", "idNumber", "voterId", "profileImage", phone, email, status,
                "accreditationCode", "qrCodeData", "reviewedBy", "reviewedAt", notes,
                "createdAt", "updatedAt"
              FROM media_accreditations
              WHERE "idNumber" = ${normalizedId} AND UPPER(category) = ${category.toUpperCase()}
              LIMIT 1
            `;
          } else {
            return await sql<MediaAccreditationResult[]>`
              SELECT 
                id, category, name, gender, company, "roleTitle", "assignedZone",
                "serviceNumber", "emergencyContact", region, street, "ghanaPostAddress",
                "idType", "idNumber", "voterId", "profileImage", phone, email, status,
                "accreditationCode", "qrCodeData", "reviewedBy", "reviewedAt", notes,
                "createdAt", "updatedAt"
              FROM media_accreditations
              WHERE "idNumber" = ${normalizedId}
              LIMIT 1
            `;
          }
        });
        if (rows && rows.length > 0) return rows[0];
      }
    } catch (dbError: any) {
      console.warn("[MEDIA ACCREDITATION] Query failed, checking cache:", dbError.message);
    }

    // Check memory store fallback
    if (code) {
      const found = inMemoryStore.get(code.trim().toUpperCase());
      if (found) return found;
    }
    if (voterId) {
      const cleanVoterId = voterId.trim();
      for (const item of inMemoryStore.values()) {
        if (item.voterId === cleanVoterId) return item;
      }
    }
    if (idNumber) {
      const normalizedId = this.normalizeId(idNumber);
      for (const item of inMemoryStore.values()) {
        if (item.idNumber === normalizedId) return item;
      }
    }

    return null;
  }

  /**
   * Links an EC voter record to an existing media accreditation pass
   */
  async linkVoterToAccreditation(params: {
    idNumber: string;
    idType?: string;
    voterId: string;
  }): Promise<MediaAccreditationResult | null> {
    const normalizedId = this.normalizeId(params.idNumber);
    const normalizedVoterId = params.voterId.trim();

    try {
      await ensureMediaAccreditationTableExists();

      const updatedRows = await withEcSql(async (sql) => {
        if (params.idType) {
          const normalizedIdType = params.idType.trim().toLowerCase();
          return await sql<MediaAccreditationResult[]>`
            UPDATE media_accreditations
            SET "voterId" = ${normalizedVoterId}, "updatedAt" = CURRENT_TIMESTAMP
            WHERE "idType" = ${normalizedIdType} AND "idNumber" = ${normalizedId}
            RETURNING 
              id, category, name, gender, company, "roleTitle", "assignedZone",
              "serviceNumber", "emergencyContact", region, street, "ghanaPostAddress",
              "idType", "idNumber", "voterId", "profileImage", phone, email, status,
              "accreditationCode", "qrCodeData", "reviewedBy", "reviewedAt", notes,
              "createdAt", "updatedAt"
          `;
        } else {
          return await sql<MediaAccreditationResult[]>`
            UPDATE media_accreditations
            SET "voterId" = ${normalizedVoterId}, "updatedAt" = CURRENT_TIMESTAMP
            WHERE "idNumber" = ${normalizedId}
            RETURNING 
              id, category, name, gender, company, "roleTitle", "assignedZone",
              "serviceNumber", "emergencyContact", region, street, "ghanaPostAddress",
              "idType", "idNumber", "voterId", "profileImage", phone, email, status,
              "accreditationCode", "qrCodeData", "reviewedBy", "reviewedAt", notes,
              "createdAt", "updatedAt"
          `;
        }
      });

      if (updatedRows && updatedRows.length > 0) {
        const updated = updatedRows[0];
        inMemoryStore.set(updated.accreditationCode, updated);
        return updated;
      }
    } catch (dbError: any) {
      console.warn("[MEDIA ACCREDITATION] Update DB error:", dbError.message);
    }

    // Memory store fallback
    for (const item of inMemoryStore.values()) {
      if (item.idNumber === normalizedId) {
        item.voterId = normalizedVoterId;
        item.updatedAt = new Date();
        return item;
      }
    }

    return null;
  }
}

export const mediaAccreditationService = new MediaAccreditationService();
