# GramSakhi (DocuLex)

GramSakhi is an AI-powered voice assistant and document management system designed for last-mile governance. It enables users to ask questions about government schemes, eligibility criteria, and welfare information using natural language. The system securely indexes and retrieves verified government documents to provide accurate, context-aware answers.

## Features

*   **AI Chat Assistant**: Ask questions and get intelligent answers powered by LLMs (supports local Llama models via Ollama and OpenAI GPT).
*   **Document Management**: Upload, parse, and index government documents (PDFs) for semantic search.
*   **Semantic Search**: Uses FAISS and SentenceTransformers (`multi-qa-mpnet-base-dot-v1`) to accurately retrieve the most relevant document chunks based on user queries.
*   **Modern Dashboard**: A clean React frontend with dynamic statistics and visual charts.

## Project Structure

The project is split into two main components:
*   `backend/`: A FastAPI backend that handles authentication, document processing, vector embeddings (FAISS), and LLM integration.
*   `frontend/`: A React frontend built with Vite and Tailwind CSS.

---

## Prerequisites

Before running the project, ensure you have the following installed:
*   **Python 3.8+**
*   **Node.js 16+** and **npm**

### Optional / Additional Requirements
*   **Ollama**: Required if you plan to run local LLMs instead of OpenAI.
    *   Install from [ollama.com](https://ollama.com/).
    *   Pull the required Llama 3.2 model: `ollama run llama3.2:3b`
*   **Docker** (Optional): Useful if you intend to run the backend or Ollama in isolated containers.

---

## Getting Started

### 1. Backend Setup

Navigate to the `backend` directory and set up your Python environment:

```bash
cd backend

# Create a virtual environment
python -m venv .venv

# Activate the virtual environment
# On Windows:
.\.venv\Scripts\activate
# On Mac/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

**Environment Variables**
Create a `.env` file in the `backend/` directory. You will need to define at least a secure secret key and any API keys you plan to use:
```env
SECRET_KEY=your_super_secret_key_here
OPENAI_API_KEY=sk-... # Optional: Only if using OpenAI models
LLAMA_API_URL=http://localhost:11434/api/generate # Default for local Ollama
```

**Run the Backend Server**
```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```
The backend API will be available at `http://localhost:8001`.

### 2. Frontend Setup

Open a new terminal, navigate to the `frontend` directory, and install the required NPM packages:

```bash
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```
The frontend will be available at `http://localhost:5173` (or the port specified by Vite).

---

## Default Users

When running locally, default test accounts may be seeded in `backend/users.json`. A common test admin account is:
*   **Username**: `testuser`
*   **Password**: *(Check the local setup instructions or create a new user via the API)*

*(Note: Never commit your `users.json` or `.env` files to Git. They are ignored by default in the `.gitignore`.)*
