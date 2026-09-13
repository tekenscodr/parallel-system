import pdfplumber

pdf_path = "/Users/THINKPAD/.gemini/antigravity/brain/f3d03715-27f9-4395-a427-73f3eb8105c3/.user_uploaded/media_1789335461731.pdf"

with pdfplumber.open(pdf_path) as pdf:
    for page_idx, page in enumerate(pdf.pages):
        print(f"Page {page_idx + 1}: {len(page.rects)} rects")
        # Filter for outer card rects: width > 400, height > 80
        cards = [r for r in page.rects if r['width'] > 400 and r['height'] > 70]
        cards = sorted(cards, key=lambda r: r['top'])
        print(f"  Outer cards: {len(cards)}")
        for c_idx, c in enumerate(cards):
            print(f"    Card {c_idx + 1}: top={c['top']:.1f}, bottom={c['bottom']:.1f}, x0={c['x0']:.1f}, x1={c['x1']:.1f}")

