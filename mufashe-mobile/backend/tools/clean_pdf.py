# backend/tools/clean_pdf.py
import os
import re
from collections import Counter
from pypdf import PdfReader

IN_DIR = os.path.join("data", "laws")
OUT_DIR = os.path.join("data", "laws_clean")

def normalize_line(line: str) -> str:
    line = re.sub(r"\s+", " ", line).strip()
    return line

def detect_repeated_lines(pages_lines, top_n=3, bottom_n=3, min_repeats_ratio=0.6):
    """
    Detect likely headers/footers by counting repeated lines in the first/last N lines of each page.
    """
    header_candidates = []
    footer_candidates = []

    for lines in pages_lines:
        if not lines:
            continue
        header_candidates.extend(lines[:top_n])
        footer_candidates.extend(lines[-bottom_n:])

    header_counts = Counter(header_candidates)
    footer_counts = Counter(footer_candidates)

    page_count = max(1, len(pages_lines))
    threshold = int(page_count * min_repeats_ratio)

    headers = {l for l, c in header_counts.items() if c >= threshold and len(l) >= 6}
    footers = {l for l, c in footer_counts.items() if c >= threshold and len(l) >= 6}

    return headers, footers

def clean_page_text(page_text: str, headers: set, footers: set) -> str:
    lines = [normalize_line(x) for x in (page_text or "").splitlines()]
    lines = [l for l in lines if l]  # drop empties

    cleaned = []
    for l in lines:
        # remove detected repeated headers/footers
        if l in headers or l in footers:
            continue

        # remove obvious page numbering patterns
        if re.fullmatch(r"Page\s*\d+", l, re.IGNORECASE):
            continue
        if re.fullmatch(r"\d+\s*/\s*\d+", l):
            continue

        cleaned.append(l)

    # join with paragraph breaks
    text = "\n".join(cleaned)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return text

def process_pdf(pdf_path: str):
    reader = PdfReader(pdf_path)
    pages_raw = [(p.extract_text() or "") for p in reader.pages]

    # Build per-page normalized line lists for header/footer detection
    pages_lines = []
    for t in pages_raw:
        lines = [normalize_line(x) for x in (t or "").splitlines()]
        lines = [l for l in lines if l]
        pages_lines.append(lines)

    headers, footers = detect_repeated_lines(pages_lines)

    cleaned_pages = []
    for t in pages_raw:
        cleaned_pages.append(clean_page_text(t, headers, footers))

    cleaned_full = "\n\n".join([p for p in cleaned_pages if p]).strip()
    return cleaned_full, headers, footers, len(reader.pages)

def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    pdfs = [f for f in os.listdir(IN_DIR) if f.lower().endswith(".pdf")]
    if not pdfs:
        raise SystemExit(f"No PDFs found in {IN_DIR}")

    for name in pdfs:
        path = os.path.join(IN_DIR, name)
        cleaned, headers, footers, n_pages = process_pdf(path)

        out_name = os.path.splitext(name)[0] + ".txt"
        out_path = os.path.join(OUT_DIR, out_name)
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(cleaned)

        print(f"\n✅ {name} ({n_pages} pages) -> {out_path}")
        if headers:
            print("Detected headers:")
            for h in list(headers)[:8]:
                print("  -", h)
        if footers:
            print("Detected footers:")
            for ft in list(footers)[:8]:
                print("  -", ft)

if __name__ == "__main__":
    main()
