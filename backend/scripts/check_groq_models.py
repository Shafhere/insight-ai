
from groq import Groq
from app.config import settings


def main():
    print("\nINSIGHT AI - AVAILABLE GROQ MODELS")
    print("=" * 50)

    if not settings.groq_api_key:
        print("GROQ_API_KEY is missing.")
        return

    try:
        client = Groq(api_key=settings.groq_api_key)

        models = client.models.list()

        for model in models.data:
            if getattr(model, "active", True):
                print(f"Model ID: {model.id}")

        print("\nModel listing successful!")

    except Exception as error:
        print("Could not retrieve models:", str(error))


if __name__ == "__main__":
    main()
