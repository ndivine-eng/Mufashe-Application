# MUFASHE Backend (Rwanda Legal Assistant)

This backend supports:
- Cleaning downloaded law PDFs into readable text
- Ingesting the cleaned text into a vector database (Chroma)
- Testing retrieval (semantic search)
- Running RAG (retrieval + AI answer) if you have an API key
- Counting dataset articles across all cleaned files
- Running an API server (FastAPI) and exposing it using ngrok

---

## 1) Project Structure

# MUFASHE Backend (Rwanda Legal Assistant)

This backend supports:
- Cleaning downloaded law PDFs into readable text
- Ingesting the cleaned text into a vector database (Chroma)
- Testing retrieval (semantic search)
- Running RAG (retrieval + AI answer) if you have an API key
- Counting dataset articles across all cleaned files
- Running an API server (FastAPI) and exposing it using ngrok

---

## 1) Project Structure

backend/
app/
ai/
embedder.py
ingest.py
retrieve_test.py
rag_answer.py
rag_test.py
run_rag.py
data/
laws/ # raw PDFs (downloaded)
laws_clean/ # cleaned .txt output
storage/
chroma/ # vector DB storage
tools/
clean_pdf.py # PDF -> TXT cleaning tool
count_articles.py
.env
package.json


---

## 2) Requirements (Python)

###  Create and activate virtual environment
**Windows (PowerShell):**
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1


pip install -r requirements.txt
