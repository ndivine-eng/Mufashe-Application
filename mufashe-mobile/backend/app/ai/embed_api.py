from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

# Load embedding model (384 dimension)
model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

app = FastAPI()

class EmbedRequest(BaseModel):
    texts: list[str]

@app.post("/embed")
def embed(req: EmbedRequest):
    if not req.texts:
        return {"vectors": [], "dim": 0}

    vectors = model.encode(req.texts, normalize_embeddings=True).tolist()
    return {
        "vectors": vectors,
        "dim": len(vectors[0])
    }