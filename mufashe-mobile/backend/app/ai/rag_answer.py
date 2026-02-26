#  RAG-based answer generation using OpenAI + ChromaDB

import os
import chromadb
from dotenv import load_dotenv
from openai import OpenAI
from app.ai.embedder import Embedder

load_dotenv()

CHROMA_DIR = "storage/chroma"
COLLECTION_NAME = "mufashe_corpus"

# Create once (cleaner)
oa = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def answer_like_google(question: str, top_k: int = 6) -> str:
    # 1) Retrieve
    client = chromadb.PersistentClient(path=CHROMA_DIR)
    col = client.get_collection(COLLECTION_NAME)

    embedder = Embedder()
    q_vec = embedder.embed([question])[0]

    results = col.query(query_embeddings=[q_vec], n_results=top_k)
    docs = results["documents"][0]
    metas = results["metadatas"][0]

    # 2) De-duplicate by (source_file, chunk_index)
    sources = []
    seen = set()
    for d, m in zip(docs, metas):
        key = (m.get("source_file"), m.get("chunk_index"))
        if key in seen:
            continue
        seen.add(key)
        sources.append(
            {
                "source_file": m.get("source_file"),
                "chunk_index": m.get("chunk_index"),
                "text": d[:1400],
            }
        )

    sources_block = "\n\n".join(
        [f"[{i+1}] {s['source_file']} (chunk {s['chunk_index']})\n{s['text']}" for i, s in enumerate(sources)]
    )

    # 3) Check key
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return "OPENAI_API_KEY is missing. Put it in backend/.env or set it in PowerShell."

    model = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")

    system = (
        "You are MUFASHE, a legal information assistant for Rwanda.\n"
        "Use ONLY the provided sources. Do NOT invent penalty rates or legal rules.\n"
        "If the sources don’t contain the rule, say you don’t have enough verified information.\n"
        "Write in simple student language and be practical.\n"
    )

    user = (
        f"User question: {question}\n\n"
        f"Sources:\n{sources_block}\n\n"
        "Answer format:\n"
        "Title: (one line)\n"
        "Quick answer: (2–3 lines)\n"
        "Steps to follow: (3–6 bullet points)\n"
        "What penalties may exist: (only if sources clearly support it)\n"
        "Sources used: list [#] file + chunk\n"
        "End with: This is legal information, not professional legal advice.\n"
    )

    resp = oa.chat.completions.create(
        model=model,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        temperature=0.2,
    )

    return resp.choices[0].message.content.strip()
