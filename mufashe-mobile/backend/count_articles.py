import os
import re

# 👇 Change this if your folder name is different
FOLDER_PATH = "data/laws_clean"

# Match "Article 1", "ARTICLE 23", etc.
pattern = re.compile(r'^\s*Article\s+\d+', re.IGNORECASE | re.MULTILINE)

total_articles = 0
files_scanned = 0

for root, dirs, files in os.walk(FOLDER_PATH):
    for file in files:
        if file.endswith(".txt"):
            files_scanned += 1
            file_path = os.path.join(root, file)

            with open(file_path, "r", encoding="utf-8") as f:
                text = f.read()
                count = len(pattern.findall(text))
                total_articles += count

print("\n========== DATASET SUMMARY ==========")
print("Files scanned:", files_scanned)
print("Total Articles found:", total_articles)
print("=====================================\n")
