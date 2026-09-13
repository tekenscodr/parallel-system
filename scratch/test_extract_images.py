import pypdf
import os
from PIL import Image
import io

pdf_path = "/Users/THINKPAD/.gemini/antigravity/brain/f3d03715-27f9-4395-a427-73f3eb8105c3/.user_uploaded/media_1789335461731.pdf"
reader = pypdf.PdfReader(pdf_path)

out_dir = "scratch/extracted_test"
os.makedirs(out_dir, exist_ok=True)

# Test extracting page 1 executive images
page = reader.pages[0]
x_objects = page["/Resources"]["/XObject"].get_object()

for obj_name in x_objects:
    x_obj = x_objects[obj_name]
    if x_obj.get("/Subtype") == "/Image":
        print(f"Name: {obj_name}, Filter: {x_obj.get('/Filter')}, Width: {x_obj.get('/Width')}, Height: {x_obj.get('/Height')}")
        # Try extracting image
        try:
            img = pypdf.filters.decode_stream_data(x_obj)
            print(f"  Decoded stream length: {len(img)}")
        except Exception as e:
            print(f"  Decode error: {e}")

