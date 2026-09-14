import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import postgres from 'postgres';

// Load environment variables from .env.local
let env = {};
if (fs.existsSync('.env.local')) {
  fs.readFileSync('.env.local', 'utf8').split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#') && line.includes('=')) {
      const [k, ...v] = line.split('=');
      env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
    }
  });
}

const dbUrl = env.DATABASE_URL || env.POSTGRES_URL;
if (!dbUrl) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const siteUrl = env.WORDPRESS_URL?.trim().replace(/\/+$/, '');
const username = env.WORDPRESS_USERNAME?.trim();
const applicationPassword = env.WORDPRESS_APPLICATION_PASSWORD?.replace(/\s/g, '');

if (!siteUrl || !username || !applicationPassword) {
  console.error('WordPress CDN credentials missing.');
  process.exit(1);
}

const authHeader = 'Basic ' + Buffer.from(`${username}:${applicationPassword}`).toString('base64');
const sql = postgres(dbUrl, { max: 5, idle_timeout: 30 });

const PUBLIC_CDN_DIR = path.resolve('public/cdn/delegates');
fs.mkdirSync(PUBLIC_CDN_DIR, { recursive: true });

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
  const filename = `tescon_president_${cleanName}-${Date.now()}.webp`;

  // Save to public CDN directory as well for local access
  const localCdnPath = path.join(PUBLIC_CDN_DIR, filename);
  fs.writeFileSync(localCdnPath, webpBuffer);
  // Also save friendly alias
  const aliasPath = path.join(PUBLIC_CDN_DIR, `tescon_${cleanName}.webp`);
  fs.writeFileSync(aliasPath, webpBuffer);

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
  console.log('================================================================');
  console.log('🚀 SYNCING GREATER ACCRA TESCON PRESIDENTS TO CDN & DATABASE');
  console.log('================================================================');

  const jsonPath = path.resolve('scratch/greater_accra_tescon_presidents.json');
  if (!fs.existsSync(jsonPath)) {
    console.error('greater_accra_tescon_presidents.json not found!');
    process.exit(1);
  }

  const items = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`Loaded ${items.length} Greater Accra TESCON records.`);

  let uploadedCount = 0;
  let insertedAllCount = 0;
  let updatedAllCount = 0;
  let insertedGaCount = 0;
  let updatedGaCount = 0;
  let insertedContactsCount = 0;
  let updatedContactsCount = 0;

  for (const item of items) {
    const fullName = item.fullName.trim();
    const position = item.position;
    const voterId = item.voterId?.trim() || null;
    const phone = item.phone?.trim() || null;
    const institution = item.institution?.trim() || 'TESCON Chapter';
    const constituency = item.constituency?.trim() || 'Greater Accra';
    const gender = item.gender || 'Male';
    const age = item.age ? parseInt(item.age, 10) : null;
    const dob = item.dateOfBirth?.trim() || null;
    const ghanaCard = item.ghanaCard?.trim() || null;
    const imagePath = item.imageSavedPath;
    const slug = (voterId || fullName).toLowerCase().replace(/[^a-z0-9]/g, '_');

    console.log(`\n[${item.index}/${items.length}] ${fullName} (${position} @ ${institution})`);

    // 1. Upload to CDN
    let cdnUrl = item.cdnImageUrl || null;
    if (!cdnUrl && item.hasPhoto && imagePath && fs.existsSync(imagePath)) {
      console.log(`  -> Uploading portrait to WordPress CDN...`);
      cdnUrl = await uploadImageToCdn(imagePath, slug);
      if (cdnUrl) {
        console.log(`  ✓ CDN URL: ${cdnUrl}`);
        item.cdnImageUrl = cdnUrl;
        uploadedCount++;
      } else {
        console.warn(`  ⚠️ Failed to upload portrait to CDN`);
      }
    } else if (cdnUrl) {
      console.log(`  ✓ Already has CDN URL: ${cdnUrl}`);
    }

    // 2. Sync to executives_all
    let existingAll = [];
    if (voterId) {
      existingAll = await sql`SELECT id FROM executives_all WHERE voter_id = ${voterId} LIMIT 1`;
    }
    if (existingAll.length === 0) {
      existingAll = await sql`
        SELECT id FROM executives_all 
        WHERE LOWER(executive_name) = LOWER(${fullName}) 
          AND LOWER(position) = LOWER(${position}) 
          AND region = 'Greater Accra'
        LIMIT 1
      `;
    }

    if (existingAll.length > 0) {
      const execId = existingAll[0].id;
      console.log(`  -> Updating executives_all record (ID: ${execId})...`);
      const updateData = {
        executive_name: fullName,
        executive_level: 'TESCON',
        slot_status: 'Elected',
        region: 'Greater Accra',
        constituency: constituency,
        polling_station: institution,
        position: position,
        gender: gender,
        phone: phone,
        status: 'Active',
      };
      if (ghanaCard) updateData.ghana_card = ghanaCard;
      if (voterId) updateData.voter_id = voterId;
      if (dob) updateData.date_of_birth = dob;
      if (age) updateData.age = age;
      if (cdnUrl) updateData.image_url = cdnUrl;

      await sql`UPDATE executives_all SET ${sql(updateData)} WHERE id = ${execId}`;
      updatedAllCount++;
    } else {
      console.log(`  -> Inserting into executives_all...`);
      const insertData = {
        executive_name: fullName,
        executive_level: 'TESCON',
        slot_status: 'Elected',
        region: 'Greater Accra',
        constituency: constituency,
        electoral_area: null,
        polling_station: institution,
        position: position,
        gender: gender,
        phone: phone,
        email: null,
        ghana_card: ghanaCard,
        voter_id: voterId,
        membership_id: null,
        date_of_birth: dob,
        age: age,
        is_youth_organiser: false,
        is_age_adjusted: false,
        record_entered_by: 'Greater Accra TESCON President Import',
        status: 'Active',
        image_url: cdnUrl,
      };
      await sql`INSERT INTO executives_all ${sql(insertData)}`;
      insertedAllCount++;
    }

    // 3. Sync to executives_greater_accra
    let existingGa = [];
    if (voterId) {
      existingGa = await sql`SELECT id FROM executives_greater_accra WHERE voter_id = ${voterId} LIMIT 1`;
    }
    if (existingGa.length === 0) {
      existingGa = await sql`
        SELECT id FROM executives_greater_accra 
        WHERE LOWER(executive_name) = LOWER(${fullName}) 
          AND LOWER(position) = LOWER(${position})
        LIMIT 1
      `;
    }

    if (existingGa.length > 0) {
      const gaId = existingGa[0].id;
      const updateData = {
        executive_name: fullName,
        executive_level: 'TESCON',
        slot_status: 'Elected',
        region: 'Greater Accra',
        constituency: constituency,
        polling_station: institution,
        position: position,
        gender: gender,
        phone: phone,
        status: 'Active',
      };
      if (ghanaCard) updateData.ghana_card = ghanaCard;
      if (voterId) updateData.voter_id = voterId;
      if (dob) updateData.date_of_birth = dob;
      if (age) updateData.age = age;
      if (cdnUrl) updateData.image_url = cdnUrl;

      await sql`UPDATE executives_greater_accra SET ${sql(updateData)} WHERE id = ${gaId}`;
      updatedGaCount++;
    } else {
      const insertData = {
        executive_name: fullName,
        executive_level: 'TESCON',
        slot_status: 'Elected',
        region: 'Greater Accra',
        constituency: constituency,
        electoral_area: null,
        polling_station: institution,
        position: position,
        gender: gender,
        phone: phone,
        email: null,
        ghana_card: ghanaCard,
        voter_id: voterId,
        membership_id: null,
        date_of_birth: dob,
        age: age,
        is_youth_organiser: false,
        is_age_adjusted: false,
        record_entered_by: 'Greater Accra TESCON President Import',
        status: 'Active',
        image_url: cdnUrl,
      };
      await sql`INSERT INTO executives_greater_accra ${sql(insertData)}`;
      insertedGaCount++;
    }

    // 4. Sync to contacts & contact_group_members
    const nameParts = fullName.split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ');

    const cleanPrimaryPhone = phone?.split('/')[0]?.replace(/[^\d]/g, '') || '';
    const normPhone = cleanPrimaryPhone.length === 9 ? '0' + cleanPrimaryPhone : cleanPrimaryPhone;

    const contactHash = crypto.createHash('md5').update(`${normPhone}_${voterId || ''}_${fullName}`).digest('hex');
    const contactId = `ct_${contactHash}`;

    const notesAge = age ? `, Age: ${age}` : '';
    const contactNotes = `Level: TESCON, Position: ${position}${notesAge}, Institution: ${institution}, Constituency: ${constituency}`;

    let existingContact = [];
    if (voterId) {
      existingContact = await sql`SELECT id FROM contacts WHERE voter_id = ${voterId} LIMIT 1`;
    }
    if (existingContact.length === 0 && normPhone) {
      existingContact = await sql`SELECT id FROM contacts WHERE phone_number = ${normPhone} LIMIT 1`;
    }
    if (existingContact.length === 0) {
      existingContact = await sql`SELECT id FROM contacts WHERE id = ${contactId} LIMIT 1`;
    }

    let activeContactId = contactId;
    const nowIso = new Date().toISOString();

    if (existingContact.length > 0) {
      activeContactId = existingContact[0].id;
      const contactUpdate = {
        first_name: firstName,
        last_name: lastName,
        notes: contactNotes,
        consent_status: 'opted_in',
        consent_source: 'national_youth_electorate',
        is_active: 1,
        updated_at: nowIso,
      };
      if (normPhone) contactUpdate.phone_number = normPhone;
      if (voterId) contactUpdate.voter_id = voterId;
      if (dob) contactUpdate.date_of_birth = dob;
      if (ghanaCard) contactUpdate.ghana_card_number = ghanaCard;

      await sql`UPDATE contacts SET ${sql(contactUpdate)} WHERE id = ${activeContactId}`;
      updatedContactsCount++;
    } else {
      const contactInsert = {
        id: contactId,
        first_name: firstName,
        last_name: lastName,
        phone_number: normPhone || null,
        email: null,
        date_of_birth: dob,
        voter_id: voterId,
        ghana_card_number: ghanaCard,
        source: 'platform',
        uploaded_by_id: null,
        upload_batch_id: null,
        preferred_language: 'en',
        consent_status: 'opted_in',
        consent_source: 'national_youth_electorate',
        opted_in_at: nowIso,
        opted_out_at: null,
        is_active: 1,
        notes: contactNotes,
        polling_station_id: 'ps_hq_national',
        created_at: nowIso,
        updated_at: nowIso,
        candidate_id: null,
      };
      await sql`INSERT INTO contacts ${sql(contactInsert)}`;
      insertedContactsCount++;
    }

    // Target groups
    const targetGroupIds = ['grp_all_electorate'];
    if (position === 'President') {
      targetGroupIds.push('grp_tescon_presidents');
    } else {
      targetGroupIds.push('grp_regional_national');
    }

    for (const gid of targetGroupIds) {
      await sql`
        INSERT INTO contact_group_members (group_id, contact_id, added_at)
        VALUES (${gid}, ${activeContactId}, ${nowIso})
        ON CONFLICT (group_id, contact_id) DO NOTHING
      `;
    }

    // Save JSON incrementally
    fs.writeFileSync(jsonPath, JSON.stringify(items, null, 2), 'utf8');
  }

  console.log(`\n✓ Saved final JSON to: ${jsonPath}`);

  console.log('\n================================================================');
  console.log('🔍 VERIFYING CDN URLs ACROSS ALL UPLOADED PORTRAITS');
  console.log('================================================================');

  const withCdn = items.filter(d => d.cdnImageUrl);
  console.log(`Verifying ${withCdn.length} CDN URLs...`);
  let allOk = true;

  for (const item of withCdn) {
    try {
      const res = await fetch(item.cdnImageUrl, { method: 'HEAD' });
      if (!res.ok) {
        console.error(`❌ CDN URL returned ${res.status}: ${item.cdnImageUrl}`);
        allOk = false;
      }
    } catch (e) {
      console.error(`❌ Failed to reach ${item.cdnImageUrl}: ${e.message}`);
      allOk = false;
    }
  }

  if (allOk && withCdn.length > 0) {
    console.log(`🎉 All ${withCdn.length} CDN URLs verified (HTTP 200 OK)!`);
  } else {
    console.warn('⚠️ Some CDN URLs could not be verified.');
  }

  console.log('\n================================================================');
  console.log('📊 FINAL SUMMARY');
  console.log(`Total Executives Processed:            ${items.length}`);
  console.log(`Photos Uploaded to CDN:                ${uploadedCount}`);
  console.log(`New rows inserted in executives_all:   ${insertedAllCount}`);
  console.log(`Rows updated in executives_all:       ${updatedAllCount}`);
  console.log(`New rows in executives_greater_accra: ${insertedGaCount}`);
  console.log(`Rows updated in executives_greater_accra: ${updatedGaCount}`);
  console.log(`New contacts inserted in contacts:    ${insertedContactsCount}`);
  console.log(`Contacts updated in contacts:        ${updatedContactsCount}`);
  console.log('================================================================');
}

main()
  .catch(console.error)
  .finally(async () => {
    await sql.end({ timeout: 2 });
    process.exit(0);
  });
