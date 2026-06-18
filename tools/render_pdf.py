import sys, fitz, os

path = sys.argv[1]
outdir = sys.argv[2]
os.makedirs(outdir, exist_ok=True)
doc = fitz.open(path)
print(f"{path}: {doc.page_count} pages")
for i, page in enumerate(doc):
    # check for images
    imgs = page.get_images()
    pix = page.get_pixmap(dpi=150)
    out = os.path.join(outdir, f"page_{i+1}.png")
    pix.save(out)
    print(f"page {i+1}: {len(imgs)} embedded images, size={page.rect}, rendered -> {out}")
