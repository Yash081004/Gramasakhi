# app/chat_prompt.py

def build_chat_prompt(messages, retrieved_chunks):
    context_parts = []
    for c in retrieved_chunks[:8]:
        citation = c.get("citation", "unknown source")
        text = c.get("text", "")
        context_parts.append(f"--- SOURCE: {citation} ---\n{text}")
    
    context = "\n\n".join(context_parts)

    hist = ""
    for m in messages[-10:]:  # last 10 msgs
        role = m['role'].upper()
        # For the latest user message, don't append it here, we will put it at the very end.
        if m == messages[-1]:
            continue
        hist += f"{role}: {m['content']}\n"
    
    latest_query = messages[-1]['content'] if messages else ""

    return f"""You are GramSakhi, an AI-powered Voice-Based Governance Assistant for Last-Mile Governance.
Your objective is to help citizens understand government schemes, eligibility, and welfare information.

STRICT RULES:
1. You MUST answer ONLY using the provided "Relevant Government Scheme Context".
2. NEVER use pretrained knowledge to fill in missing details about government schemes.
3. NEVER invent eligibility criteria, benefits, monetary amounts, required documents, deadlines, application procedures, or government links.
4. If the provided context is about a different scheme than what the user asked, you MUST refuse to answer.
5. If the provided context does not contain enough evidence to fully answer the question, say exactly: "I could not find sufficient verified information in the available government documents to answer this question."
6. You MUST cite your sources using inline brackets referencing the SOURCE name provided above each chunk. For example: "According to [PM-KISAN - pmkisan.pdf - page 2 (chunk 5)], the eligibility is..."
7. Keep the language simple, clear, and empathetic.
8. If the user asks in Hindi or another language, reply in that language, but maintain accurate details from the context.

Relevant Government Scheme Context:
{context}

Previous Conversation:
{hist}

USER: {latest_query}
GRAMSAKHI (ASSISTANT):"""
