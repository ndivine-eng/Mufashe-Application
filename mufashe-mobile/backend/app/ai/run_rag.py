import json
import sys
from rag_answer import answer_question

def main():
    try:
        payload = json.loads(sys.stdin.read())
        message = payload.get("message", "").strip()

        if not message:
            print(json.dumps({"answer": "Please ask a question."}))
            return

        answer = answer_question(message)

        print(json.dumps({"answer": answer}))
    except Exception as e:
        print(json.dumps({"answer": "AI error occurred."}))

if __name__ == "__main__":
    main()
