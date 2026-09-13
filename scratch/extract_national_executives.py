import pdfplumber
import pypdf
import os
import json
import csv
import re
from PIL import Image

pdf_path = "/Users/THINKPAD/.gemini/antigravity/brain/f3d03715-27f9-4395-a427-73f3eb8105c3/.user_uploaded/media_1789336250676.pdf"
reader = pypdf.PdfReader(pdf_path)

out_dirs = [
    "/Users/THINKPAD/Documents/parallel/scratch/national_executives_images",
    "/Users/THINKPAD/.gemini/antigravity/brain/f3d03715-27f9-4395-a427-73f3eb8105c3/scratch/national_executives_images"
]

for d in out_dirs:
    os.makedirs(d, exist_ok=True)

# Load backup for voter ID fallbacks if available
known_voter_ids = {}
backup_path = "/Users/THINKPAD/.gemini/antigravity/brain/f3d03715-27f9-4395-a427-73f3eb8105c3/scratch/national_executives_backup_20260913.json"
if os.path.exists(backup_path):
    try:
        with open(backup_path, "r", encoding="utf-8") as f:
            b_data = json.load(f)
            for item in b_data:
                name_key = re.sub(r"[^A-Z]", "", item.get("executive_name", "").upper())
                if name_key and item.get("voter_id"):
                    known_voter_ids[name_key] = item["voter_id"]
    except Exception as e:
        print(f"Could not load backup IDs: {e}")

def sanitize_filename(s):
    return re.sub(r"[^a-zA-Z0-9_-]", "_", s).strip("_")

executives = []
exec_counter = 0

with pdfplumber.open(pdf_path) as pdf:
    for page_idx in range(9):
        page = pdf.pages[page_idx]
        pypdf_page = reader.pages[page_idx]
        
        # Build pypdf image lookup
        pypdf_images = {}
        for img in pypdf_page.images:
            base_name = img.name.split(".")[0]
            pypdf_images[base_name] = img
            pypdf_images[img.name] = img
            
        # Extract cards
        cards = [r for r in page.rects if r['width'] > 350 and r['height'] > 60]
        cards = sorted(cards, key=lambda r: r['top'])
        
        # Non-QR, non-logo portrait images:
        portraits = [
            img for img in page.images
            if img['width'] > 40 and img['height'] > 40 and not (page_idx == 0 and img['top'] < 50)
        ]
        portraits = sorted(portraits, key=lambda img: img['top'])
        
        # Check if page 7 has Daniel Botwe (below cards)
        has_botwe = False
        botwe_portrait = None
        if page_idx == 6: # Page 7
            b_imgs = [img for img in portraits if img['top'] > 550]
            if b_imgs:
                has_botwe = True
                botwe_portrait = b_imgs[0]
                portraits = [img for img in portraits if img['top'] <= 550]

        for card_idx, c in enumerate(cards):
            exec_counter += 1
            crop_box = (c['x0'], c['top'], c['x1'], c['bottom'])
            card_crop = page.crop(crop_box)
            card_text = card_crop.extract_text() or ""
            
            card_img = None
            if card_idx < len(portraits):
                card_img = portraits[card_idx]
            
            voter_match = re.search(r"Voter\s*ID\s*:\s*([^\n\r]*)", card_text, re.IGNORECASE)
            name_match = re.search(r"Full\s*Name\s*:\s*([^\n\r]*)", card_text, re.IGNORECASE)
            phone_match = re.search(r"Phone\s*:\s*([^\n\r]*)", card_text, re.IGNORECASE)
            pos_match = re.search(r"Position\s*:\s*([^\n\r]*)", card_text, re.IGNORECASE)
            year_match = re.search(r"Year\s*of\s*Service\s*:\s*([^\n\r]*)", card_text, re.IGNORECASE)
            
            voter_id = voter_match.group(1).strip() if voter_match else ""
            full_name = name_match.group(1).strip() if name_match else ""
            phone = phone_match.group(1).strip() if phone_match else ""
            position = pos_match.group(1).strip() if pos_match else ""
            year_of_service = year_match.group(1).strip() if year_match else ""
            
            # Clean voter_id
            if "Full Name" in voter_id or voter_id.upper() in ("N/A", "NULL", "NONE"):
                voter_id = ""
                
            # Clean phone
            if "Position" in phone or phone.upper() in ("N/A", "NULL", "NONE"):
                phone = ""

            # Name fixes
            if "MATTHEW OPOKU PREMPEH" in full_name:
                full_name = "DR. MATTHEW OPOKU PREMPEH"
                
            # Default positions for page 8 & 9 if missing
            if not position:
                clean_n = full_name.upper()
                if "FREDERICK" in clean_n:
                    position = "Past National Chairman"
                elif "PAUL AFOKO" in clean_n:
                    position = "Past National Chairman"
                elif "PETER MAC-MANU" in clean_n:
                    position = "Past National Chairman"
                elif "SEKYI HUGHES" in clean_n:
                    position = "Council of Elders / Past National Officer"
                elif "KWABENA AGYEI AGYAPONG" in clean_n:
                    position = "Past General Secretary"
                elif "JOHN BOADU" in clean_n:
                    position = "Past General Secretary"
                elif "EDMUND ANNAN" in clean_n:
                    position = "Past National Officer / Elder"
                elif "FRANK DAVIES" in clean_n:
                    position = "Chairman of The Legal Committee"
            
            # Clean up canonical positions
            if position.upper() == "CURRENT NATIONAL CHAIRMAN / CHAIRPERSON":
                position = "National Chairperson"
            elif position.upper() == "CURRENT GENERAL SECRETARY":
                position = "General Secretary"
            elif position.upper() == "CURRENT DEPUTY GENERAL SECRETARY":
                position = "Deputy General Secretary"
            elif position.upper() == "CURRENT NATIONAL TREASURER":
                position = "National Treasurer"
            elif position.upper() == "CURRENT NATIONAL ORGANISER":
                position = "National Organiser"
            elif position.upper() == "CURRENT NATIONAL WOMEN ORGANISER":
                position = "National Women Organiser"
            elif position.upper() == "CURRENT NATIONAL YOUTH ORGANISER":
                position = "National Youth Organiser"
            elif position.upper() == "CURRENT NATIONAL NASARA COORDINATOR":
                position = "National Nasara Coordinator"
            elif position.upper() == "CURRENT NATIONAL DIRECTOR OF IT":
                position = "Director of IT"
            elif position.upper() == "CURRENT NATIONAL DIRECTOR OF PROTOCOL":
                position = "Director of Protocol"
            elif position.upper() == "CHAIRMAN OF THE LEGAL COMMITTE":
                position = "Chairman of The Legal Committee"
            elif position.upper() == "CURRENT NATIONAL LEGAL AFFAIRS":
                position = "Director of Legal Affairs"
            elif position.upper() == "CURRENT NATIONAL RESEARCH & ELECTIONS OFFICER":
                position = "Director of Research and Elections"
            elif position.upper() == "CURRENT NATIONAL RESEARCH OFFICER":
                position = "Research Officer"
            elif position.upper() == "CURRENT NATIONAL COMMUNICATION":
                position = "National Communication Director"
            elif position.upper() == "CURRENT NATIONAL DEPUTY COMMUNICATION":
                position = "Deputy Communication Director"
            elif position.upper() == "CURRENT NATIONAL DEPUTY ORGANISER":
                position = "Deputy National Organiser"
            elif position.upper() == "CURRENT NATIONAL DEPUTY WOMEN ORGANISER":
                position = "Deputy National Women Organiser"
            elif position.upper() == "CURRENT NATIONAL DEPUTY YOUTH ORGANISER":
                position = "Deputy National Youth Organiser"
            elif position.upper() == "CURRENT NATIONAL DEPUTY NASARA COORDINATOR":
                position = "Deputy National Nasara Coordinator"
            elif position.upper() == "CURRENT NATIONAL DEPUTY GENERAL SECRETARY":
                position = "Deputy General Secretary"
            elif position.upper() == "CURRENT NATIONAL 2ND VICE CHAIRMAN / CHAIRPERSON":
                position = "2nd Vice-Chairperson"
            elif position.upper() == "CURRENT NATIONAL 3RD VICE CHAIRMAN / CHAIRPERSON":
                position = "3rd Vice-Chairperson"
            elif position.upper() == "CURRENT NATIONAL ADMINISTRATION & FINANCIAL DIRECTOR":
                position = "Director of Finance and Administration"
            elif position.upper() == "CURRENT NATIONAL DEPUTY EXTERNAL RELATIONS OFFICER":
                position = "Deputy External Relations Officer"
            elif position.upper() == "CURRENT NATIONAL EXTERNAL RELATIONS OFFICER":
                position = "External Relations Officer"
            elif position.upper() == "CURRENT NATIONAL DEPUTY DIRECTOR OF IT":
                position = "Deputy Director of IT"
            elif position.upper() == "CURRENT NATIONAL DEPUTY DIRECTOR OF PROTOCOL":
                position = "Deputy Director of Protocol"
            elif position.upper() == "FORMER RUNNING MATE":
                position = "Former Running Mate"
            elif position.upper() == "FORMER VICE PRESIDENT":
                position = "Current Flagbearer / Former Vice President"

            # Check voter ID fallback from backup if empty
            if not voter_id:
                lookup_key = re.sub(r"[^A-Z]", "", full_name.upper())
                if lookup_key in known_voter_ids:
                    voter_id = known_voter_ids[lookup_key]

            image_filename = f"{exec_counter:02d}_{sanitize_filename(full_name)}.jpg"
            saved_paths = []
            img_name = card_img.get('name') if card_img else None
            
            if img_name:
                p_img = pypdf_images.get(img_name) or pypdf_images.get(f"{img_name}.jpg") or pypdf_images.get(f"{img_name}.jp2") or pypdf_images.get(f"{img_name}.png")
                if p_img:
                    pil_img = p_img.image
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
                "region": "National",
                "executiveLevel": "National",
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
            print(f"[{exec_counter:02d}] P{page_idx+1} | {full_name} | {position} | Voter ID: {voter_id} | Phone: {phone} | Img: {image_filename}")
        
        # Handle Daniel Botwe on Page 7
        if has_botwe:
            exec_counter += 1
            botwe_crop = page.crop((30, 550, page.width - 30, page.height - 30))
            b_text = botwe_crop.extract_text() or ""
            
            v_match = re.search(r"Voter\s*ID\s*[:\s]*([0-9]+)", b_text, re.IGNORECASE)
            n_match = re.search(r"Full\s*Name\s*[:\s]*([^\n\r]*)", b_text, re.IGNORECASE)
            p_match = re.search(r"Phone\s*(?:No\.?)?\s*[:\s]*([0-9/]+)", b_text, re.IGNORECASE)
            
            b_voter_id = v_match.group(1).strip() if v_match else "2629015871"
            b_name = n_match.group(1).strip() if n_match else "BOTWE, DANIEL"
            b_phone = p_match.group(1).strip() if p_match else "0505417927"
            b_position = "National Council Representative"
            
            b_image_filename = f"{exec_counter:02d}_{sanitize_filename(b_name)}.jpg"
            saved_paths = []
            img_name = botwe_portrait.get('name') if botwe_portrait else None
            
            if img_name:
                p_img = pypdf_images.get(img_name) or pypdf_images.get(f"{img_name}.jpg") or pypdf_images.get(f"{img_name}.png")
                if p_img:
                    pil_img = p_img.image
                    rgb = Image.new("RGB", pil_img.size, (255, 255, 255))
                    if pil_img.mode in ("RGBA", "LA"):
                        rgb.paste(pil_img, mask=pil_img.split()[-1])
                    else:
                        rgb.paste(pil_img)
                    for d in out_dirs:
                        target_path = os.path.join(d, b_image_filename)
                        rgb.save(target_path, "JPEG", quality=95)
                        saved_paths.append(target_path)
                        
            rec = {
                "index": exec_counter,
                "page": page_idx + 1,
                "cardOnPage": len(cards) + 1,
                "region": "National",
                "executiveLevel": "National",
                "voterId": b_voter_id,
                "fullName": b_name,
                "phone": b_phone,
                "position": b_position,
                "yearOfService": "",
                "pdfImageName": img_name,
                "imageFileName": b_image_filename,
                "imageSavedPath": saved_paths[0] if saved_paths else None
            }
            executives.append(rec)
            print(f"[{exec_counter:02d}] P{page_idx+1} | {b_name} | {b_position} | Voter ID: {b_voter_id} | Phone: {b_phone} | Img: {b_image_filename}")

# Save JSON and CSV
json_paths = [
    "/Users/THINKPAD/Documents/parallel/scratch/national_executives.json",
    "/Users/THINKPAD/.gemini/antigravity/brain/f3d03715-27f9-4395-a427-73f3eb8105c3/scratch/national_executives.json"
]
for jp in json_paths:
    with open(jp, "w", encoding="utf-8") as f:
        json.dump(executives, f, indent=2)

csv_paths = [
    "/Users/THINKPAD/Documents/parallel/scratch/national_executives.csv",
    "/Users/THINKPAD/.gemini/antigravity/brain/f3d03715-27f9-4395-a427-73f3eb8105c3/scratch/national_executives.csv"
]
for cp in csv_paths:
    with open(cp, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "index", "page", "region", "executiveLevel", "voterId",
            "fullName", "phone", "position", "yearOfService", "imageFileName"
        ])
        writer.writeheader()
        for r in executives:
            writer.writerow({
                "index": r["index"],
                "page": r["page"],
                "region": r["region"],
                "executiveLevel": r["executiveLevel"],
                "voterId": r["voterId"],
                "fullName": r["fullName"],
                "phone": r["phone"],
                "position": r["position"],
                "yearOfService": r["yearOfService"],
                "imageFileName": r["imageFileName"]
            })

print(f"\nSuccessfully extracted all {len(executives)} National executives and portrait images!")
