import pdfplumber
import pypdf

pdf_path = "/Users/THINKPAD/.gemini/antigravity/brain/f3d03715-27f9-4395-a427-73f3eb8105c3/.user_uploaded/media_1789336250676.pdf"
reader = pypdf.PdfReader(pdf_path)

print("Total pages in PDF:", len(reader.pages))

with pdfplumber.open(pdf_path) as pdf:
    for page_idx, page in enumerate(pdf.pages):
        cards = [r for r in page.rects if r['width'] > 350 and r['height'] > 60]
        cards = sorted(cards, key=lambda r: r['top'])
        print(f"\nPage {page_idx + 1}: {len(page.images)} images, {len(cards)} card rects")
        for img_idx, img in enumerate(page.images):
            print(f"  Img: name={img.get('name')}, x0={img['x0']:.1f}, top={img['top']:.1f}, x1={img['x1']:.1f}, bottom={img['bottom']:.1f}, w={img['width']:.1f}, h={img['height']:.1f}")
        for c_idx, c in enumerate(cards):
            print(f"  Card {c_idx+1}: top={c['top']:.1f}, bottom={c['bottom']:.1f}, x0={c['x0']:.1f}, x1={c['x1']:.1f}")
