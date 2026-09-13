import pdfplumber
import pypdf
import os
import re

pdf_path = "/Users/THINKPAD/.gemini/antigravity/brain/f3d03715-27f9-4395-a427-73f3eb8105c3/.user_uploaded/media_1789335461731.pdf"

with pdfplumber.open(pdf_path) as pdf:
    for page_idx, page in enumerate(pdf.pages):
        cards = [r for r in page.rects if r['width'] > 400 and r['height'] > 70]
        cards = sorted(cards, key=lambda r: r['top'])
        print(f"\n--- PAGE {page_idx + 1} ({len(cards)} cards) ---")
        for c_idx, c in enumerate(cards):
            # Crop card text area (between image and QR code: x from 120 to 460)
            crop_box = (c['x0'], c['top'], c['x1'], c['bottom'])
            card_crop = page.crop(crop_box)
            card_text = card_crop.extract_text() or ""
            
            # Find image in this card
            card_images = [
                img for img in page.images
                if img['x0'] < 200 and img['top'] >= c['top'] - 15 and img['bottom'] <= c['bottom'] + 15
            ]
            img_names = [img.get('name') for img in card_images]
            print(f"Card {c_idx + 1}: Image={img_names}")
            lines = [l.strip() for l in card_text.split("\n") if l.strip()]
            for l in lines:
                print(f"    {l}")

