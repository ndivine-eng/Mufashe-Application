import sys
from app.ai.rag_answer import answer_like_google

if __name__ == "__main__":
    q = " ".join(sys.argv[1:]).strip()
    if not q:
        print('Usage: python -m app.ai.rag_test "your question"')
        raise SystemExit(1)

    print("\n" + answer_like_google(q) + "\n")
