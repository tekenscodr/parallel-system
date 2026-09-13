import pdfplumber
import pypdf
import os
import json
import csv
import re
from PIL import Image

pdf_path = "/Users/THINKPAD/.gemini/antigravity/brain/f3d03715-27f9-4395-a427-73f3eb8105c3/.user_uploaded/media_1789335461731.pdf"
reader = pypdf.PdfReader(pdf_path)

out_dirs = [
    "/Users/THINKPAD/Documents/parallel/scratch/tescon_nasara_images",
    "/Users/THINKPAD/.gemini/antigravity/brain/f3d03715-27f9-4395-a427-73f3eb8105c3/scratch/tescon_nasara_images"
]

for d in out_dirs:
    os.makedirs(d, exist_ok=True)

# Helper to clean institution names
def clean_institution(inst):
    if not inst:
        return ""
    s = inst.strip()
    # Remove leading "INSTITUTION:"
    s = re.sub(r"^INSTITUTION\s*:\s*", "", s, flags=re.IGNORECASE)
    # Fix broken spacing
    fixes = [
        ("AFRICAN UNIVERSITY OF COMMUNICATION & BUSINESS", "African University of Communication & Business"),
        ("VALLEY VIEW UNIVERSITY, OYIBI", "Valley View University, Oyibi"),
        ("UNIVERSITY OF GHANA (MAIN CAMPUS)", "University of Ghana (Main Campus)"),
        ("RADFORD UNIVERSITY COLLEGE", "Radford University College"),
        ("HERITAGE CHRISTIAN UNIVERSITY", "Heritage Christian University"),
        ("PEN TECOST UNIVERSITY COLLEGE", "Pentecost University College"),
        ("PENTECOST UNIVERSITY COLLEGE", "Pentecost University College"),
        ("REG ENT UNIVERSITY OF SCIENCE AND TECHNOLOGY", "Regent University of Science and Technology"),
        ("ACC RA BUSINESS SCHOOL", "Accra Business School"),
        ("ACCRA BUSINESS SCHOOL", "Accra Business School"),
        ("WIS CONSIN INTERNATIONAL UNIVERSITY", "Wisconsin International University"),
        ("NUR SING AND MIDWIFERY TRAINING COLLEGE,KORLE BU", "Nursing and Midwifery Training College, Korle Bu"),
        ("NURSING AND MIDWIFERY TRAINING COLLEGE,KORLE BU", "Nursing and Midwifery Training College, Korle Bu"),
        ("UG MEDICAL SCHOOL, KORLE BU", "UG Medical School, Korle Bu"),
        ("CEN TRAL UNIVERSITY", "Central University"),
        ("CENTRAL UNIVERSITY", "Central University"),
        ("UNIVERSITY OF GHANA(ACCRA CITY CAMPUS)", "University of Ghana (Accra City Campus)"),
        ("UNIVERSITY OF GHANA(DISTANCE EDUCATION)", "University of Ghana (Distance Education)"),
        ("BLUECREST UNIVERSITY", "BlueCrest University"),
        ("METHODIST UNIVERSITY GHANA(DANSOMAN)", "Methodist University Ghana (Dansoman)"),
        ("KNU TSFORD UNIVERSITY COLLEGE", "Knutsford University College"),
        ("KNUTSFORD UNIVERSITY COLLEGE", "Knutsford University College"),
        ("ISL AMIC UNIVERSITY", "Islamic University"),
        ("ISLAMIC UNIVERSITY", "Islamic University"),
        ("GH ANA COMMUNICATION TECHNOLOGY UNIVERSITY", "Ghana Communication Technology University"),
        ("GHANA COMMUNICATION TECHNOLOGY UNIVERSITY", "Ghana Communication Technology University"),
        ("UN IVERSITY OF MEDIA, ARTS AND COMMUNICATION", "University of Media, Arts and Communication"),
        ("UNIVERSITY OF MEDIA, ARTS AND COMMUNICATION", "University of Media, Arts and Communication"),
        ("RE GIONAL MARITIME UNIVERSITY", "Regional Maritime University"),
        ("REGIONAL MARITIME UNIVERSITY", "Regional Maritime University"),
        ("ME THODIST UNIVERSITY GHANA(TEMA CAMPUS)", "Methodist University Ghana (Tema Campus)"),
        ("METHODIST UNIVERSITY GHANA(TEMA CAMPUS)", "Methodist University Ghana (Tema Campus)"),
        ("NA RH-BITA COLLEGE", "Narh-Bita College"),
        ("NARH-BITA COLLEGE", "Narh-Bita College"),
        ("PA NTANG NMTC", "Pantang NMTC"),
        ("PANTANG NMTC", "Pantang NMTC"),
        ("GHA NA INSTITUTE OF MANAGEMENT AND PUBLIC ADMINISTRATION", "Ghana Institute of Management and Public Administration (GIMPA)"),
        ("GHANA INSTITUTE OF MANAGEMENT AND PUBLIC ADMINISTRATION", "Ghana Institute of Management and Public Administration (GIMPA)"),
        ("UN IVERSITY OF PROFESSIONAL STUDIES, ACCRA", "University of Professional Studies, Accra (UPSA)"),
        ("UNIVERSITY OF PROFESSIONAL STUDIES, ACCRA", "University of Professional Studies, Accra (UPSA)"),
        ("AC CRA TECHNICAL UN IVERSITY", "Accra Technical University"),
        ("ACCRA TECHNICAL UN IVERSITY", "Accra Technical University"),
        ("AC CRA TECHNICAL UNIVERSITY", "Accra Technical University"),
        ("ACCRA TECHNICAL UNIVERSITY", "Accra Technical University"),
        ("UN IVERSITY OF GHANA ALLIED HEALTH SCIENCE,KORLE BU", "University of Ghana Allied Health Science, Korle Bu"),
        ("UNIVERSITY OF GHANA ALLIED HEALTH SCIENCE,KORLE BU", "University of Ghana Allied Health Science, Korle Bu"),
        ("AC CRA COLLEGE OF EDUCATION", "Accra College of Education"),
        ("ACCRA COLLEGE OF EDUCATION", "Accra College of Education"),
        ("ADA COOLEGE OF EDUCATION", "Ada College of Education"),
        ("KIN GS UNIVERSITY COLLEGE", "Kings University College"),
        ("KINGS UNIVERSITY COLLEGE", "Kings University College"),
        ("GH ANA INSTITUTE OF LANGUAGES", "Ghana Institute of Languages"),
        ("GHANA INSTITUTE OF LANGUAGES", "Ghana Institute of Languages"),
        ("DAT ALINK UNIVERSITY", "Datalink University"),
        ("DATALINK UNIVERSITY", "Datalink University"),
        ("MO UNTCREST UNIVERSITY", "MountCrest University"),
        ("MOUNTCREST UNIVERSITY", "MountCrest University"),
        ("GIM PA", "GIMPA"),
        ("GIMPA", "GIMPA")
    ]
    for pattern, rep in fixes:
        if pattern.upper() == s.upper():
            return rep
    return s

def sanitize_filename(s):
    return re.sub(r"[^a-zA-Z0-9_-]", "_", s).strip("_")

executives = []
exec_counter = 0

with pdfplumber.open(pdf_path) as pdf:
    for page_idx, page in enumerate(pdf.pages):
        pypdf_page = reader.pages[page_idx]
        
        # Build map of image name -> pypdf Image object
        pypdf_images = {}
        for img in pypdf_page.images:
            base_name = img.name.split(".")[0]
            pypdf_images[base_name] = img
            pypdf_images[img.name] = img
        
        cards = [r for r in page.rects if r['width'] > 400 and r['height'] > 70]
        cards = sorted(cards, key=lambda r: r['top'])
        
        for card_idx, c in enumerate(cards):
            exec_counter += 1
            # Text inside the card
            crop_box = (c['x0'], c['top'], c['x1'], c['bottom'])
            card_crop = page.crop(crop_box)
            card_text = card_crop.extract_text() or ""
            
            # Find executive portrait image on the left (x0 < 200)
            card_images = [
                img for img in page.images
                if img['x0'] < 200 and img['top'] >= c['top'] - 20 and img['bottom'] <= c['bottom'] + 20
            ]
            
            if not card_images:
                print(f"Warning: No portrait found for Page {page_idx+1} Card {card_idx+1}")
                img_name = None
            else:
                # If multiple, take the largest or left-most
                img_name = card_images[0].get('name')
            
            # Parse text fields
            inst_match = re.search(r"INSTITUTION\s*:\s*(.*)", card_text, re.IGNORECASE)
            voter_match = re.search(r"Voter\s*ID\s*:\s*([^\n\r]*)", card_text, re.IGNORECASE)
            name_match = re.search(r"Full\s*Name\s*:\s*([^\n\r]*)", card_text, re.IGNORECASE)
            phone_match = re.search(r"Phone\s*:\s*([^\n\r]*)", card_text, re.IGNORECASE)
            pos_match = re.search(r"Position\s*:\s*([^\n\r]*)", card_text, re.IGNORECASE)
            year_match = re.search(r"Year\s*of\s*Service\s*:\s*([^\n\r]*)", card_text, re.IGNORECASE)
            
            institution = clean_institution(inst_match.group(1).strip()) if inst_match else ""
            voter_id = voter_match.group(1).strip() if voter_match else ""
            full_name = name_match.group(1).strip() if name_match else ""
            phone = phone_match.group(1).strip() if phone_match else ""
            position = pos_match.group(1).strip() if pos_match else "NASARA"
            year_of_service = year_match.group(1).strip() if year_match else ""
            
            if voter_id.upper() == "NULL":
                voter_id = ""
            
            # Extract and save image
            image_filename = f"{exec_counter:02d}_{sanitize_filename(full_name)}.jpg"
            saved_paths = []
            
            if img_name and (img_name in pypdf_images or f"{img_name}.jpg" in pypdf_images or f"{img_name}.jp2" in pypdf_images or f"{img_name}.png" in pypdf_images):
                p_img = pypdf_images.get(img_name) or pypdf_images.get(f"{img_name}.jpg") or pypdf_images.get(f"{img_name}.jp2") or pypdf_images.get(f"{img_name}.png")
                pil_img = p_img.image
                # Convert to RGB clean
                rgb = Image.new("RGB", pil_img.size, (255, 255, 255))
                if pil_img.mode in ("RGBA", "LA"):
                    rgb.paste(pil_img, mask=pil_img.split()[-1])
                else:
                    rgb.paste(pil_img)
                
                for d in out_dirs:
                    target_path = os.path.join(d, image_filename)
                    rgb.save(target_path, "JPEG", quality=95)
                    saved_paths.append(target_path)
            
            rec = {
                "index": exec_counter,
                "page": page_idx + 1,
                "cardOnPage": card_idx + 1,
                "region": "Greater Accra",
                "executiveLevel": "TESCON",
                "institution": institution,
                "voterId": voter_id,
                "fullName": full_name,
                "phone": phone,
                "position": position,
                "yearOfService": year_of_service,
                "pdfImageName": img_name,
                "imageFileName": image_filename,
                "imageSavedPath": saved_paths[0] if saved_paths else None
            }
            executives.append(rec)
            print(f"[{exec_counter:02d}] Page {page_idx+1} | {full_name} | {institution} | Voter ID: {voter_id} | Phone: {phone} | Img: {image_filename}")

# Save JSON and CSV
json_paths = [
    "/Users/THINKPAD/Documents/parallel/scratch/tescon_nasara_executives.json",
    "/Users/THINKPAD/.gemini/antigravity/brain/f3d03715-27f9-4395-a427-73f3eb8105c3/scratch/tescon_nasara_executives.json"
]
for jp in json_paths:
    with open(jp, "w", encoding="utf-8") as f:
        json.dump(executives, f, indent=2)

csv_paths = [
    "/Users/THINKPAD/Documents/parallel/scratch/tescon_nasara_executives.csv",
    "/Users/THINKPAD/.gemini/antigravity/brain/f3d03715-27f9-4395-a427-73f3eb8105c3/scratch/tescon_nasara_executives.csv"
]
for cp in csv_paths:
    with open(cp, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "index", "page", "region", "executiveLevel", "institution", "voterId",
            "fullName", "phone", "position", "yearOfService", "imageFileName"
        ])
        writer.writeheader()
        for r in executives:
            writer.writerow({
                "index": r["index"],
                "page": r["page"],
                "region": r["region"],
                "executiveLevel": r["executiveLevel"],
                "institution": r["institution"],
                "voterId": r["voterId"],
                "fullName": r["fullName"],
                "phone": r["phone"],
                "position": r["position"],
                "yearOfService": r["yearOfService"],
                "imageFileName": r["imageFileName"]
            })

print(f"\nSuccessfully extracted {len(executives)} executives and images!")
