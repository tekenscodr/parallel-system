import pdfplumber
import pypdf
import os
import re
from PIL import Image

pdf_path = "/Users/THINKPAD/.gemini/antigravity/brain/f3d03715-27f9-4395-a427-73f3eb8105c3/.user_uploaded/media_1789335461731.pdf"
reader = pypdf.PdfReader(pdf_path)

output_dir = "scratch/extracted_tescon_nasara_images"
os.makedirs(output_dir, exist_ok=True)

with pdfplumber.open(pdf_path) as pdf:
    for page_idx, page in enumerate(pdf.pages):
        print(f"\n================ PAGE {page_idx + 1} ================")
        text = page.extract_text(layout=True)
        print("--- RAW TEXT ---")
        print(text)
