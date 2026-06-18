import sys, fitz

# crop_page.py <pdf> <page_1based> <x0> <y0> <x1> <y1> <out> [dpi]
# coords in PDF points (page is typically 612x792)
path, page_no = sys.argv[1], int(sys.argv[2])
x0, y0, x1, y1 = map(float, sys.argv[3:7])
out = sys.argv[7]
dpi = int(sys.argv[8]) if len(sys.argv) > 8 else 400
doc = fitz.open(path)
page = doc[page_no - 1]
clip = fitz.Rect(x0, y0, x1, y1)
pix = page.get_pixmap(dpi=dpi, clip=clip)
pix.save(out)
print(f"cropped {out} ({pix.width}x{pix.height})")
