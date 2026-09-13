import os
import io
import re
import json
import pdfplumber
import pypdf
from PIL import Image

PDF_PATH = '/Users/THINKPAD/.gemini/antigravity/brain/f3d03715-27f9-4395-a427-73f3eb8105c3/.user_uploaded/media_1789339074586.pdf'
OUTPUT_DIR = '/Users/THINKPAD/Documents/parallel/scratch/greater_accra_wocom_images'
JSON_PATH = '/Users/THINKPAD/Documents/parallel/scratch/greater_accra_wocom_executives.json'
CSV_PATH = '/Users/THINKPAD/Documents/parallel/scratch/greater_accra_wocom_executives.csv'

os.makedirs(OUTPUT_DIR, exist_ok=True)

INSTITUTION_NORMALIZATIONS = {
    'REGENT UNIVERSITY COLLEGE OF SCIENCE AND': 'Regent University College of Science and Technology',
    'REGENT UNIVERSITY COLLEGE OF SCIENCE AND TECHNOLOGY': 'Regent University College of Science and Technology',
    'NURSING AND MIDWIFERY TRAINING COLLEGE,': 'Nursing and Midwifery Training College, Korle Bu',
    'NURSING AND MIDWIFERY TRAINING COLLEGE, KORLE-BU': 'Nursing and Midwifery Training College, Korle Bu',
    'U G, ACCRA CITY CAMPUS': 'UG Accra City Campus',
    'UG, ACCRA CITY CAMPUS': 'UG Accra City Campus',
    'U NIVERSITY OF MEDIA,ART AND TECHNOLOGY': 'University of Media, Arts and Technology',
    'UNIVERSITY OF MEDIA,ART AND TECHNOLOGY': 'University of Media, Arts and Technology',
    'I SLAMIC UNIVERSITY': 'Islamic University',
    'D ATA LINK UNIVERSITY': 'Data Link University',
    'DATA LINK UNIVERSITY': 'Data Link University',
    'BLECREST UNIVERSITY COLLEGE': 'BlueCrest University College',
}

CONSTITUENCY_MAP = {
    'African University of Communication': 'Korle Klottey',
    'Valley View University Oyibi': 'Adentan',
    'University of Ghana': 'Ayawaso West Wuogon',
    'Radford University College': 'Ayawaso Central',
    'Heritage Christian University': 'Amasaman',
    'Pentecost University College': 'Anyaa/Sowutuom',
    'Regent University College of Science and Technology': 'Weija-Gbawe',
    'Accra Business School': 'Ayawaso West Wuogon',
    'Wisconsin International University': 'Madina',
    'Nursing and Midwifery Training College, Korle Bu': 'Ablekuma South',
    'UG Medical School, Korle Bu': 'Ablekuma South',
    'Central University': 'Ningo Prampram',
    'UG Accra City Campus': 'Korle Klottey',
    'Kings University': 'Weija-Gbawe',
    'BlueCrest University': 'Ayawaso East',
    'Methodist University Dansoman': 'Ablekuma West',
    'Accra Technical University': 'Korle Klottey',
    'Knutsford University College': 'Ayawaso West Wuogon',
    'Ghana Communication Technology University': 'Okaikwei Central',
    'University of Media, Arts and Technology': 'Ayawaso West Wuogon',
    'Regional Maritime University': 'Krowor',
    'Methodist University Ghana, Tema Campus': 'Tema Central',
    'GIMPA': 'Ayawaso West Wuogon',
    'Pantang NMTC': 'Madina',
    'Islamic University': 'Adentan',
    'University of Ghana (Distance Education)': 'Ayawaso West Wuogon',
    'Accra College of Education': 'Ayawaso West Wuogon',
    'Ada College of Education': 'Ada',
    'School of Allied Health': 'Ablekuma South',
    'Data Link University': 'Tema Central',
    'Narh-Bita College': 'Tema Central',
    'Entrance University of Health Sciences': 'Ledzokuku',
    'Zenith College': 'La Dadekotopon',
    'Ghana Institute of Languages': 'Korle Klottey',
    'MountCrest University': 'Ayawaso East',
    'University of Professional Studies, Accra': 'Madina',
    'BlueCrest University College': 'Ayawaso East',
}

def clean_phone(p):
    if not p: return ''
    parts = re.split(r'[/,]', p.strip())
    cleaned_parts = []
    for part in parts:
        nums = re.sub(r'[^0-9]', '', part)
        if len(nums) == 9 and not nums.startswith('0'):
            nums = '0' + nums
        if nums:
            cleaned_parts.append(nums)
    return ' / '.join(cleaned_parts)

def clean_name(n):
    n = re.sub(r'\s+', ' ', n.strip())
    return n

def extract():
    reader = pypdf.PdfReader(PDF_PATH)
    with pdfplumber.open(PDF_PATH) as pdf:
        executives = []
        card_index = 1
        
        for page_idx, page in enumerate(pdf.pages):
            pypdf_page = reader.pages[page_idx]
            
            # Map pypdf images by base name
            pypdf_images = {}
            for img in pypdf_page.images:
                base = os.path.splitext(img.name)[0]
                pypdf_images[base] = img
            
            boxes = [r for r in page.rects if r['width'] > 400 and r['height'] > 50]
            boxes.sort(key=lambda b: b['top'])
            
            portraits = [
                img for img in page.images
                if img['x0'] < 150 and img['width'] > 40 and img['height'] > 40 and not (page_idx == 0 and img['top'] < 50)
            ]
            
            for b_idx, box in enumerate(boxes):
                crop = page.crop((box['x0'], box['top'], box['x1'], box['bottom']))
                text = crop.extract_text() or ''
                lines = [l.strip() for l in text.split('\n') if l.strip()]
                
                inst = ''
                vid = ''
                name = ''
                phone = ''
                pos = ''
                
                for l in lines:
                    if 'INSTITUTION:' in l.upper():
                        inst = re.sub(r'INSTITUTION:\s*', '', l, flags=re.IGNORECASE).strip()
                    elif 'VOTER ID:' in l.upper():
                        vid = re.sub(r'VOTER ID:\s*', '', l, flags=re.IGNORECASE).strip()
                    elif 'FULL NAME:' in l.upper():
                        name = re.sub(r'FULL NAME:\s*', '', l, flags=re.IGNORECASE).strip()
                    elif 'PHONE:' in l.upper():
                        phone = re.sub(r'PHONE:\s*', '', l, flags=re.IGNORECASE).strip()
                    elif 'POSITION:' in l.upper():
                        pos = re.sub(r'POSITION:\s*', '', l, flags=re.IGNORECASE).strip()
                
                if not inst:
                    for l in lines:
                        if not any(k in l.upper() for k in ['VOTER', 'NAME', 'PHONE', 'POSITION', 'YEAR', 'OBBINAH']):
                            inst = l
                            break
                
                # Check for wrapped institution line in first 2 lines
                if len(lines) > 1 and lines[1] in ['TECHNOLOGY', 'KORLE-BU']:
                    inst = f'{inst} {lines[1]}'
                
                inst = INSTITUTION_NORMALIZATIONS.get(inst.strip(), inst.strip())
                if vid.lower() in ['null', 'none']:
                    vid = ''
                
                name = clean_name(name)
                phone = clean_phone(phone)
                
                standard_pos = 'President' if 'PRESIDENT' in pos.upper() else 'WOCOM'
                gender = 'Male' if standard_pos == 'President' else 'Female'
                
                # Find matching portrait
                matched_img_info = None
                for p in portraits:
                    p_center_y = p['top'] + p['height']/2
                    if box['top'] <= p_center_y <= box['bottom']:
                        matched_img_info = p
                        break
                
                image_filename = ''
                image_saved_path = ''
                
                if matched_img_info:
                    img_name = matched_img_info['name']
                    pypdf_img = pypdf_images.get(img_name)
                    if pypdf_img:
                        clean_name_slug = re.sub(r'[^a-zA-Z0-9]', '_', name)
                        image_filename = f'{card_index:02d}_{clean_name_slug}.jpg'
                        image_saved_path = os.path.join(OUTPUT_DIR, image_filename)
                        
                        pil_img = Image.open(io.BytesIO(pypdf_img.data)).convert('RGB')
                        pil_img.save(image_saved_path, 'JPEG', quality=95)
                    else:
                        print(f'Warning: pypdf image not found for {img_name}')
                
                constituency = None
                inst_lower = inst.lower()
                for cmap_k, cmap_v in CONSTITUENCY_MAP.items():
                    if cmap_k.lower() == inst_lower:
                        constituency = cmap_v
                        break
                if not constituency:
                    for cmap_k, cmap_v in CONSTITUENCY_MAP.items():
                        if cmap_k.lower() in inst_lower or inst_lower in cmap_k.lower():
                            constituency = cmap_v
                            break
                
                rec = {
                    'index': card_index,
                    'page': page_idx + 1,
                    'cardOnPage': b_idx + 1,
                    'region': 'Greater Accra',
                    'executiveLevel': 'TESCON',
                    'institution': inst,
                    'constituency': constituency,
                    'voterId': vid,
                    'fullName': name,
                    'phone': phone,
                    'position': standard_pos,
                    'gender': gender,
                    'hasPhoto': bool(image_saved_path),
                    'imageFileName': image_filename,
                    'imageSavedPath': image_saved_path,
                }
                executives.append(rec)
                card_index += 1
                
        print(f"Total executives extracted: {len(executives)}")
        photo_count = sum(1 for e in executives if e['hasPhoto'])
        print(f"Total photos saved: {photo_count}")
        
        with open(JSON_PATH, 'w', encoding='utf-8') as f:
            json.dump(executives, f, indent=2)
            
        return executives

if __name__ == '__main__':
    extract()
