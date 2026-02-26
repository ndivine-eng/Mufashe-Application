# app/ai/retrieve_test.py
import sys
import chromadb
from app.ai.embedder import Embedder

CHROMA_DIR = "storage/chroma"
COLLECTION_NAME = "mufashe_corpus"

def run_query(question: str, top_k: int = 5):
    client = chromadb.PersistentClient(path=CHROMA_DIR)
    col = client.get_collection(COLLECTION_NAME)

    embedder = Embedder()
    q_vec = embedder.embed([question])[0]

    results = col.query(query_embeddings=[q_vec], n_results=top_k)

    docs = results["documents"][0]
    metas = results["metadatas"][0]

    print(f"\nQuestion: {question}\n")
    print("Top matches:\n")
    for i, (d, m) in enumerate(zip(docs, metas), start=1):
        print(f"--- Match {i} ---")
        print("Source:", m.get("source_file"))
        print("Chunk:", m.get("chunk_index"))
        print(d[:700].replace("\n", " ") + "...")
        print()

def main():
    # Usage:
    # python app\ai\retrieve_test.py "your question here"
    if len(sys.argv) < 2:
        print("Usage: python app\\ai\\retrieve_test.py \"your question here\"")
        return

    question = " ".join(sys.argv[1:]).strip()
    run_query(question, top_k=5)

if __name__ == "__main__":
    main()
