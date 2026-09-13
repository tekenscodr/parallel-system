import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import postgres from 'postgres';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const siteUrl = process.env.WORDPRESS_URL?.trim().replace(/\/+$/, '');
const username = process.env.WORDPRESS_USERNAME?.trim();
const applicationPassword = process.env.WORDPRESS_APPLICATION_PASSWORD?.replace(/\s/g, '');

if (!siteUrl || !username || !applicationPassword) {
  console.error('WordPress CDN credentials missing.');
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
  const filename = `wocom_${cleanName}-${Date.now()}.webp`;

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
      if (cdnUrl) return cdnUrl;
      throw new Error('No source_url in response');
    } catch (err) {
      console.warn(`Upload attempt ${attempts} failed for ${filename}: ${err.message}`);
      if (attempts >= 3) return null;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  return null;
}

async function main() {
  console.log('========================================================');
  console.log('--- SYNCING GREATER ACCRA WOCOM TO CDN AND DATABASE ---');
  console.log('========================================================');

  const jsonPath = path.resolve('scratch/greater_accra_wocom_executives.json');
  if (!fs.existsSync(jsonPath)) {
    console.error('greater_accra_wocom_executives.json not found!');
    process.exit(1);
  }

  const items = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`Loaded ${items.length} executive records.`);

  // Check existing WOCOM in Greater Accra
  const existingRows = await sql`
    SELECT id, executive_name, voter_id, position, polling_station, image_url 
    FROM executives_all 
    WHERE executive_level = 'TESCON' AND region = 'Greater Accra'
  `;
  console.log(`Existing Greater Accra TESCON records in DB: ${existingRows.length}`);

  let uploadedCount = 0;
  let insertedCount = 0;
  let updatedCount = 0;

  for (const item of items) {
    const fullName = item.fullName.trim();
    const position = item.position;
    const voterId = item.voterId?.trim() || null;
    const phone = item.phone?.trim() || null;
    const institution = item.institution?.trim() || 'TESCON';
    const constituency = item.constituency?.trim() || null;
    const gender = item.gender || 'Female';
    const imagePath = item.imageSavedPath;
    const slug = voterId || fullName.toLowerCase().replace(/[^a-z0-9]/g, '_');

    console.log(`\n[${item.index}/${items.length}] ${fullName} (${position} @ ${institution})`);

    let cdnUrl = item.cdnImageUrl || null;
    if (!cdnUrl && item.hasPhoto && imagePath && fs.existsSync(imagePath)) {
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
    } else {
      console.log(`  -> No photo on card`);
    }

    // Check if record exists
    const existing = existingRows.find(
      (r) =>
        (voterId && r.voter_id === voterId) ||
        (r.executive_name.toLowerCase() === fullName.toLowerCase() &&
          r.position.toLowerCase() === position.toLowerCase())
    );

    if (existing) {
      console.log(`  Updating existing DB record (ID: ${existing.id})...`);
      await sql`
        UPDATE executives_all SET
          executive_name = ${fullName},
          executive_level = 'TESCON',
          region = 'Greater Accra',
          constituency = COALESCE(${constituency}, constituency),
          polling_station = ${institution},
          position = ${position},
          gender = ${gender},
          phone = COALESCE(${phone}, phone),
          voter_id = COALESCE(${voterId}, voter_id),
          image_url = COALESCE(${cdnUrl}, image_url),
          status = 'Active'
        WHERE id = ${existing.id}
      `;
      updatedCount++;
    } else {
      console.log(`  Inserting new record into DB...`);
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
          ${constituency},
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
          'Greater Accra WOCOM Import',
          'Active',
          ${cdnUrl}
        )
      `;
      insertedCount++;
    }
  }

  // Save updated JSON
  fs.writeFileSync(jsonPath, JSON.stringify(items, null, 2), 'utf8');

  console.log('\n=============================================');
  console.log('--- VERIFYING CDN URLs BEFORE LOCAL DELETION ---');
  console.log('=============================================');

  const withCdn = items.filter((d) => d.cdnImageUrl);
  console.log(`Verifying ${withCdn.length} CDN URLs...`);
  let allOk = true;

  for (const item of withCdn) {
    try {
      const res = await fetch(item.cdnImageUrl, { method: 'HEAD' });
      if (!res.ok) {
        console.error(`ERROR: CDN URL returned ${res.status}: ${item.cdnImageUrl}`);
        allOk = false;
      }
    } catch (e) {
      console.error(`ERROR: Failed to reach ${item.cdnImageUrl}: ${e.message}`);
      allOk = false;
    }
  }

  if (allOk && withCdn.length > 0) {
    console.log(`All ${withCdn.length} CDN URLs verified (HTTP 200)!`);
    const localDir = path.resolve('scratch/greater_accra_wocom_images');
    if (fs.existsSync(localDir)) {
      const count = fs.readdirSync(localDir).length;
      fs.rmSync(localDir, { recursive: true, force: true });
      console.log(`Deleted local image directory: ${localDir} (${count} files removed).`);
    }
  } else {
    console.warn('CDN verification had issues; keeping local images safe.');
  }

  console.log('\n=============================================');
  console.log('--- FINAL SUMMARY ---');
  console.log(`Photos uploaded to CDN: ${uploadedCount}`);
  console.log(`Records inserted to DB: ${insertedCount}`);
  console.log(`Records updated in DB: ${updatedCount}`);
  console.log('=============================================');
}

main()
  .catch(console.error)
  .finally(async () => {
    await sql.end({ timeout: 2 });
    process.exit(0);
  });
