from dotenv import load_dotenv
import os

load_dotenv(dotenv_path="../.env", override=True)

print("OPENAI:", repr(os.getenv("OPENAI_API_KEY")))
print("LLAMA:", repr(os.getenv("LLAMA_API_URL")))
