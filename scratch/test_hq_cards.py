import pdfplumber

pdf_path = "/Users/THINKPAD/.gemini/antigravity/brain/f3d03715-27f9-4395-a427-73f3eb8105c3/.user_uploaded/media_1789336250676.pdf"

with pdfplumber.open(pdf_path) as pdf:
    for page_idx, page in enumerate(pdf.pages):
        print(f"\n================ PAGE {page_idx + 1} ================")
        text = page.extract_text(layout=True)
        print(text)
