
from app.services.llm_service import generate_response


def main():
    print("\nINSIGHT AI - GROQ CONNECTION TEST")
    print("-" * 45)

    prompt = """
    You are the AI intelligence engine of INSIGHT AI.

    Explain in simple terms:
    What is exploratory data analysis?

    Keep your answer within 100 words.
    """

    try:
        answer = generate_response(prompt)

        print("\nAI RESPONSE:\n")
        print(answer)

        print("\n" + "-" * 45)
        print("GROQ CONNECTION SUCCESSFUL!")

    except Exception as error:
        print("\nGROQ CONNECTION FAILED")
        print("Error:", str(error))


if __name__ == "__main__":
    main()
