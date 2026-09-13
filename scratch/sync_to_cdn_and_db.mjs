import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import postgres from 'postgres';

// Ensure required environment variables
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const siteUrl = process.env.WORDPRESS_URL?.trim().replace(/\/+$/, '');
const username = process.env.WORDPRESS_USERNAME?.trim();
const applicationPassword = process.env.WORDPRESS_APPLICATION_PASSWORD?.replace(/\s/g, '');

if (!siteUrl || !username || !applicationPassword) {
  console.error('WordPress CDN credentials are missing in environment.');
  process.exit(1);
}

const authHeader = 'Basic ' + Buffer.from(`${username}:${applicationPassword}`).toString('base64');
const sql = postgres(dbUrl, { max: 5, idle_timeout: 30 });

async function uploadImageToCdn(imagePath, baseName) {
  if (!fs.existsSync(imagePath)) {
    console.warn(`File not found: ${imagePath}`);
    return null;
  }

  const rawBuffer = fs.readFileSync(imagePath);
  const webpBuffer = await sharp(rawBuffer)
    .rotate()
    .webp({ quality: 85, effort: 4 })
    .toBuffer();

  const cleanName = baseName.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  const filename = `${cleanName}-${Date.now()}.webp`;

  let attempts = 0;
  while (attempts < 3) {
    attempts++;
    try {
      const res = await fetch(`${siteUrl}/wp-json/wp/v2/media`, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
          'Content-Type': 'image/webp',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
        body: webpBuffer,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      const data = await res.json();
      const cdnUrl = data.source_url || data.guid?.rendered;
      if (cdnUrl) {
        return cdnUrl;
      }
      throw new Error('No source_url in response');
    } catch (err) {
      console.warn(`Upload attempt ${attempts} failed for ${filename}: ${err.message}`);
      if (attempts >= 3) return null;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  return null;
}

// Known gender mappings for National Executives
const NATIONAL_GENDERS = {
  'RITA TALATA ASOBAYIRE': 'Female',
  'ANTOINETTE TSIBOE-DARKO': 'Female',
  'SANDRA SARKODEE-ADDO': 'Female',
  'KATE GYAMFUAH': 'Female',
  'MIRIAM AWURAMA DUAH': 'Female',
  'HAJIA SAFIA MOHAMMED': 'Female',
  'AYISHETU YUSIF': 'Female',
  'JENNIFER APPIAH OFORI QUEEN': 'Female',
  'PORTIA SIAW': 'Female',
};

async function processNationalExecutives() {
  console.log('\n=============================================');
  console.log('--- PROCESSING NATIONAL EXECUTIVES (46) ---');
  console.log('=============================================');

  const jsonPath = path.resolve('scratch/national_executives.json');
  if (!fs.existsSync(jsonPath)) {
    console.error('national_executives.json not found');
    return;
  }

  const items = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`Found ${items.length} National executives.`);

  // Check if any National executives are already in database
  const existingRows = await sql`
    SELECT id, executive_name, voter_id, position 
    FROM executives_all 
    WHERE executive_level = 'National' OR region = 'National'
  `;
  console.log(`Currently existing National executives in DB: ${existingRows.length}`);

  let uploadedCount = 0;
  let insertedCount = 0;
  let updatedCount = 0;

  for (const item of items) {
    const fullName = item.fullName.trim();
    const position = item.position?.trim() || 'National Officer';
    const voterId = item.voterId?.trim() || null;
    const phone = item.phone?.trim() || null;
    const gender = NATIONAL_GENDERS[fullName.toUpperCase()] || 'Male';
    const imagePath = item.imageSavedPath;
    const slug = voterId || fullName.toLowerCase().replace(/[^a-z0-9]/g, '_');

    console.log(`\n[${item.index}/${items.length}] ${fullName} (${position})`);

    let cdnUrl = item.cdnImageUrl || null;
    if (!cdnUrl && imagePath && fs.existsSync(imagePath)) {
      console.log(`  Uploading photo to CDN...`);
      cdnUrl = await uploadImageToCdn(imagePath, slug);
      if (cdnUrl) {
        console.log(`  -> CDN URL: ${cdnUrl}`);
        item.cdnImageUrl = cdnUrl;
        uploadedCount++;
      } else {
        console.warn(`  -> Failed to upload to CDN`);
      }
    } else if (cdnUrl) {
      console.log(`  -> Already has CDN URL: ${cdnUrl}`);
    }

    // Check if already in DB
    const existing = existingRows.find(
      (r) =>
        (voterId && r.voter_id === voterId) ||
        r.executive_name.toLowerCase() === fullName.toLowerCase()
    );

    if (existing) {
      console.log(`  Updating existing DB record (ID: ${existing.id})...`);
      await sql`
        UPDATE executives_all SET
          executive_name = ${fullName},
          executive_level = 'National',
          region = 'National',
          position = ${position},
          phone = COALESCE(${phone}, phone),
          voter_id = COALESCE(${voterId}, voter_id),
          gender = ${gender},
          image_url = COALESCE(${cdnUrl}, image_url),
          status = 'Active'
        WHERE id = ${existing.id}
      `;
      updatedCount++;
    } else {
      console.log(`  Inserting new National record into DB...`);
      const isYouth = position.toLowerCase().includes('youth');
      await sql`
        INSERT INTO executives_all (
          executive_name,
          executive_level,
          slot_status,
          region,
          constituency,
          electoral_area,
          polling_station,
          position,
          gender,
          phone,
          email,
          ghana_card,
          voter_id,
          membership_id,
          date_of_birth,
          age,
          is_youth_organiser,
          is_age_adjusted,
          record_entered_by,
          status,
          image_url
        ) VALUES (
          ${fullName},
          'National',
          'Elected',
          'National',
          NULL,
          NULL,
          NULL,
          ${position},
          ${gender},
          ${phone},
          NULL,
          NULL,
          ${voterId},
          NULL,
          NULL,
          NULL,
          ${isYouth},
          false,
          'National Headquarters Import',
          'Active',
          ${cdnUrl}
        )
      `;
      insertedCount++;
    }
  }

  // Persist updated JSON with CDN URLs
  fs.writeFileSync(jsonPath, JSON.stringify(items, null, 2), 'utf8');
  console.log(`\n--- NATIONAL SUMMARY ---`);
  console.log(`Photos uploaded to CDN: ${uploadedCount}`);
  console.log(`Records inserted to DB: ${insertedCount}`);
  console.log(`Records updated in DB: ${updatedCount}`);
}

// Known gender mappings for TESCON Nasara
const FEMALE_NASARA_KEYWORDS = [
  'KHARIYA', 'HAFSATU', 'RAMATU', 'NUAMAH DORIS', 'ASMAWU',
  'RUBAIYA', 'SAHADATU', 'DOROTHY', 'HAIRA', 'AMINA', 'RAKIA',
  'SEMIRATU', 'MEIMUNA', 'JEMIMA', 'FAUZIA', 'HANIFA'
];

async function processTesconNasaraExecutives() {
  console.log('\n=============================================');
  console.log('--- PROCESSING TESCON NASARA EXECUTIVES (36) ---');
  console.log('=============================================');

  const jsonPath = path.resolve('scratch/tescon_nasara_executives.json');
  if (!fs.existsSync(jsonPath)) {
    console.warn('tescon_nasara_executives.json not found');
    return;
  }

  const items = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`Found ${items.length} TESCON Nasara executives.`);

  // Check existing TESCON Nasara in Greater Accra
  const existingRows = await sql`
    SELECT id, executive_name, voter_id, position, polling_station, image_url
    FROM executives_all 
    WHERE executive_level = 'TESCON' AND region = 'Greater Accra' AND position ILIKE '%Nasara%'
  `;
  console.log(`Currently existing Greater Accra TESCON Nasara in DB: ${existingRows.length}`);

  let uploadedCount = 0;
  let insertedCount = 0;
  let updatedCount = 0;

  for (const item of items) {
    const fullName = item.fullName.trim();
    const position = 'Nasara Coordinator';
    const voterId = item.voterId?.trim() || null;
    const phone = item.phone?.trim() || null;
    const institution = item.institution?.trim() || 'TESCON';
    const imagePath = item.imageSavedPath;
    const slug = voterId || fullName.toLowerCase().replace(/[^a-z0-9]/g, '_');

    const isFemale = FEMALE_NASARA_KEYWORDS.some(k => fullName.toUpperCase().includes(k));
    const gender = isFemale ? 'Female' : 'Male';

    console.log(`\n[${item.index}/${items.length}] ${fullName} (${institution})`);

    let cdnUrl = item.cdnImageUrl || null;
    if (!cdnUrl && imagePath && fs.existsSync(imagePath)) {
      console.log(`  Uploading photo to CDN...`);
      cdnUrl = await uploadImageToCdn(imagePath, slug);
      if (cdnUrl) {
        console.log(`  -> CDN URL: ${cdnUrl}`);
        item.cdnImageUrl = cdnUrl;
        uploadedCount++;
      } else {
        console.warn(`  -> Failed to upload to CDN`);
      }
    } else if (cdnUrl) {
      console.log(`  -> Already has CDN URL: ${cdnUrl}`);
    }

    // Check if already in DB
    const existing = existingRows.find(
      (r) =>
        (voterId && r.voter_id === voterId) ||
        r.executive_name.toLowerCase() === fullName.toLowerCase() ||
        (r.polling_station && r.polling_station.toLowerCase() === institution.toLowerCase())
    );

    if (existing) {
      console.log(`  Updating existing DB record (ID: ${existing.id})...`);
      await sql`
        UPDATE executives_all SET
          executive_name = ${fullName},
          executive_level = 'TESCON',
          region = 'Greater Accra',
          polling_station = ${institution},
          position = ${position},
          phone = COALESCE(${phone}, phone),
          voter_id = COALESCE(${voterId}, voter_id),
          gender = ${gender},
          image_url = COALESCE(${cdnUrl}, image_url),
          status = 'Active'
        WHERE id = ${existing.id}
      `;
      updatedCount++;
    } else {
      console.log(`  Inserting new TESCON Nasara record into DB...`);
      await sql`
        INSERT INTO executives_all (
          executive_name,
          executive_level,
          slot_status,
          region,
          constituency,
          electoral_area,
          polling_station,
          position,
          gender,
          phone,
          email,
          ghana_card,
          voter_id,
          membership_id,
          date_of_birth,
          age,
          is_youth_organiser,
          is_age_adjusted,
          record_entered_by,
          status,
          image_url
        ) VALUES (
          ${fullName},
          'TESCON',
          'Elected',
          'Greater Accra',
          NULL,
          NULL,
          ${institution},
          ${position},
          ${gender},
          ${phone},
          NULL,
          NULL,
          ${voterId},
          NULL,
          NULL,
          NULL,
          false,
          false,
          'TESCON Nasara Import',
          'Active',
          ${cdnUrl}
        )
      `;
      insertedCount++;
    }
  }

  // Persist updated JSON with CDN URLs
  fs.writeFileSync(jsonPath, JSON.stringify(items, null, 2), 'utf8');
  console.log(`\n--- TESCON NASARA SUMMARY ---`);
  console.log(`Photos uploaded to CDN: ${uploadedCount}`);
  console.log(`Records inserted to DB: ${insertedCount}`);
  console.log(`Records updated in DB: ${updatedCount}`);
}

async function main() {
  try {
    await processNationalExecutives();
    await processTesconNasaraExecutives();
    console.log('\n=============================================');
    console.log('ALL SYNCS SUCCESSFULLY COMPLETED!');
    console.log('=============================================');
  } catch (err) {
    console.error('Sync failed:', err);
  } finally {
    await sql.end({ timeout: 2 });
    process.exit(0);
  }
}

main();
