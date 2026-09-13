import pdfplumber

pdf_path = "/Users/THINKPAD/.gemini/antigravity/brain/f3d03715-27f9-4395-a427-73f3eb8105c3/.user_uploaded/media_1789335461731.pdf"

with pdfplumber.open(pdf_path) as pdf:
    for page_idx, page in enumerate(pdf.pages):
        print(f"--- PAGE {page_idx + 1} (width={page.width:.1f}, height={page.height:.1f}) ---")
        images = page.images
        sorted_images = sorted(images, key=lambda img: (round(img["top"], 1), round(img["x0"], 1)))
        for img_idx, img in enumerate(sorted_images):
            name = img.get('name')
            x0 = img['x0']
            top = img['top']
            x1 = img['x1']
            bottom = img['bottom']
            w = img['width']
            h = img['height']
            print(f"  Img {img_idx}: name={name}, x0={x0:.1f}, top={top:.1f}, x1={x1:.1f}, bottom={bottom:.1f}, w={w:.1f}, h={h:.1f}")
