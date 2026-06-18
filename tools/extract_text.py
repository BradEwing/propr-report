import sys, fitz

path = sys.argv[1]
doc = fitz.open(path)
print(f"=== {path} | {doc.page_count} pages ===")
for i, page in enumerate(doc):
    text = page.get_text()
    print(f"\n----- PAGE {i+1} -----")
    print(text)
