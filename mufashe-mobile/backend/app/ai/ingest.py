# app/ai/ingest.py
import os
import re
import uuid
from typing import List, Dict, Tuple

import chromadb
from chromadb.config import Settings

from app.ai.embedder import Embedder

# We will ingest from cleaned TXT files first (recommended)
LAWS_CLEAN_DIR = os.path.join("data", "laws_clean")
CHROMA_DIR = os.path.join("storage", "chroma")
COLLECTION_NAME = "mufashe_corpus"

def read_txt(path: str) -> str:
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        return f.read().strip()

def clean_text(text: str) -> str:
    text = text.replace("\r", "\n")
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    return text.strip()

def chunk_text(text: str, chunk_size: int = 900, overlap: int = 150) -> List[str]:
    text = clean_text(text)
    if len(text) <= chunk_size:
        return [text]

    chunks = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end == len(text):
            break
        start = max(0, end - overlap)
    return chunks

def load_clean_txts(folder: str) -> List[Tuple[str, str]]:
    docs = []
    if not os.path.exists(folder):
        return docs

    for name in os.listdir(folder):
        if not name.lower().endswith(".txt"):
            continue
        path = os.path.join(folder, name)
        text = read_txt(path)
        if text.strip():
            docs.append((name, text))
    return docs

def ingest():
    os.makedirs(CHROMA_DIR, exist_ok=True)

    client = chromadb.PersistentClient(
        path=CHROMA_DIR,
        settings=Settings(anonymized_telemetry=False),
    )

    collection = client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"purpose": "MUFASHE legal corpus for RAG"},
    )

    docs = load_clean_txts(LAWS_CLEAN_DIR)
    if not docs:
        raise RuntimeError(
            f"No cleaned .txt files found in '{LAWS_CLEAN_DIR}'. "
            f"Run tools/clean_pdf.py first or put .txt files there."
        )

    embedder = Embedder()

    all_ids = []
    all_texts = []
    all_metas: List[Dict] = []

    for filename, full_text in docs:
        chunks = chunk_text(full_text, chunk_size=900, overlap=150)
        for i, ch in enumerate(chunks):
            all_ids.append(str(uuid.uuid4()))
            all_texts.append(ch)
            all_metas.append({
                "source_file": filename,
                "chunk_index": i,
                "doc_type": "case_or_law"
            })

    batch_size = 64
    for i in range(0, len(all_texts), batch_size):
        batch_texts = all_texts[i:i+batch_size]
        batch_ids = all_ids[i:i+batch_size]
        batch_metas = all_metas[i:i+batch_size]
        vectors = embedder.embed(batch_texts)

        collection.add(
            ids=batch_ids,
            documents=batch_texts,
            embeddings=vectors,
            metadatas=batch_metas,
        )

    print(f"✅ Ingested {len(docs)} docs into Chroma")
    print(f"✅ Stored {len(all_texts)} chunks")
    print(f"📁 Chroma path: {CHROMA_DIR}")
    print(f"📦 Collection: {COLLECTION_NAME}")

if __name__ == "__main__":
    ingest()
