import logging
from typing import List, Dict, Optional
from app.llm import call_llm

logger = logging.getLogger(__name__)

def validate_evidence(question: str, context_chunks: List[Dict], model: str = "llama") -> bool:
    """
    Validates whether the retrieved context contains sufficient evidence to answer the user's question.
    Returns True if SUPPORTED, False if UNSUPPORTED.
    
    Responsibilities:
    - Determine whether the retrieved government context actually contains sufficient evidence.
    - Check if the requested scheme/program/policy is actually represented in the context.
    - Do NOT answer the question.
    - Do NOT use outside/pretrained knowledge.
    
    Fails closed: any error or malformed output returns False (UNSUPPORTED).
    """
    if not context_chunks:
        return False
        
    # Combine context chunks into a single string for validation
    context_text = "\n\n".join([f"Chunk {i+1}:\n{c.get('text', '')}" for i, c in enumerate(context_chunks)])
    
    prompt = f"""You are a Relevance Validator for a government assistant.
Is the retrieved context relevant to the user's question?

RULES:
1. You must ONLY use the provided context.
2. If the context discusses the SAME scheme, policy, or topic the user asked about, output SUPPORTED.
3. If the context is about a DIFFERENT scheme or policy than what the user asked, output UNSUPPORTED. (e.g., if user asks about PM-KISAN but context is Goa IT Policy, output UNSUPPORTED).
4. If the user asks about an acronym (like ITSYS) and the context discusses the full name (IT Saksham Yuva Scheme), output SUPPORTED.
5. You do NOT need the complete answer to the question. As long as the context is generally about the requested scheme, output SUPPORTED.
6. Output EXACTLY ONE WORD: either SUPPORTED or UNSUPPORTED.

User Question: {question}

Context:
{context_text}

Decision:"""

    try:
        response = call_llm(prompt=prompt, model=model, max_tokens=10)
        logger.info(f"Validator output: {response}")
        
        if not response:
            logger.warning("Evidence validator returned empty response. Failing closed (UNSUPPORTED).")
            return False
            
        decision = response.strip().upper()
        
        # Clean up any potential markdown or punctuation
        if "SUPPORTED" in decision and "UNSUPPORTED" not in decision:
            return True
        elif "UNSUPPORTED" in decision:
            return False
        else:
            logger.warning(f"Evidence validator returned malformed response: '{decision}'. Failing closed (UNSUPPORTED).")
            return False
            
    except Exception as e:
        logger.error(f"Evidence validation failed: {e}. Failing closed (UNSUPPORTED).")
        return False

