import pdfplumber
import pypdf

pdf_path = "/Users/THINKPAD/.gemini/antigravity/brain/f3d03715-27f9-4395-a427-73f3eb8105c3/.user_uploaded/media_1789336250676.pdf"
reader = pypdf.PdfReader(pdf_path)

with pdfplumber.open(pdf_path) as pdf:
    for page_idx in range(9):
        page = pdf.pages[page_idx]
        cards = [r for r in page.rects if r['width'] > 350 and r['height'] > 60]
        cards = sorted(cards, key=lambda r: r['top'])
        print(f"\n================ PAGE {page_idx + 1} ({len(cards)} card rects, {len(page.images)} images) ================")
        
        # Non-QR images (QR codes in this PDF have width ~ 22.5 or x0 > 450)
        # Wait, let's see what QR code sizes are in this PDF!
        for img in page.images:
            name = img.get('name')
            x0 = img['x0']
            top = img['top']
            w = img['width']
            h = img['height']
            print(f"  Img {name}: x0={x0:.1f}, top={top:.1f}, w={w:.1f}, h={h:.1f}")

