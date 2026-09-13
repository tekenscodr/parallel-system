import pypdf
import os
from PIL import Image
import io

pdf_path = "/Users/THINKPAD/.gemini/antigravity/brain/f3d03715-27f9-4395-a427-73f3eb8105c3/.user_uploaded/media_1789335461731.pdf"
reader = pypdf.PdfReader(pdf_path)

out_dir = "scratch/extracted_test"
os.makedirs(out_dir, exist_ok=True)

page = reader.pages[0]
for img in page.images:
    print(f"img.name: {img.name}, type: {type(img)}")
    # Save image
    with open(os.path.join(out_dir, img.name), "wb") as f:
        f.write(img.data)

print("Saved files:", os.listdir(out_dir))
