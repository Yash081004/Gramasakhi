import logging
from typing import List, Dict
from .llm import call_gpt, call_llama, _get_openai_key, _get_llama_url

logger = logging.getLogger(__name__)

def rewrite_query_for_retrieval(history: List[Dict[str, str]], current_query: str, model: str) -> str:
    """
    Lightweight conversational query rewriter.
    Uses the last 2-3 turns to resolve pronouns or implied context.
    Returns ONLY the rewritten query.
    """
    if not history:
        return current_query
        
    # Take only the last 3 turns to avoid excessive context
    recent_history = history[-3:]
    history_str = "\n".join([f"{msg['role'].capitalize()}: {msg['content']}" for msg in recent_history])
    
    prompt = f"""You are a query rewriting assistant for GramSakhi, a government information portal.
Your task is to rewrite the latest user query to be fully self-contained for semantic search, using the conversation history to resolve any missing context (like scheme names or pronouns).

RULES:
1. Do not answer the question.
2. Do not add factual government information.
3. Do not introduce scheme names unless they already appear in the conversation history.
4. Do not use pretrained knowledge to guess what the user means.
5. If the current query is already standalone, return it exactly as is.
6. Return ONLY the rewritten query string. No extra words, no quotes, no markdown.

Conversation History:
{history_str}

Latest Query: {current_query}

Rewritten Query:"""

    try:
        if "gpt" in model.lower():
            if not _get_openai_key():
                return current_query
            response = call_gpt(prompt, max_tokens=200)
        else:
            if not _get_llama_url():
                return current_query
            response = call_llama(prompt, model=model, max_tokens=200)
            
        if not response:
            return current_query
            
        rewritten = response.strip().strip('"').strip("'")
        
        # basic sanity check: if the model returned an empty string or something suspiciously long, fallback
        if not rewritten or len(rewritten) > max(300, len(current_query) * 4):
            logger.warning("Query rewriting generated suspicious output, falling back to original.")
            return current_query
            
        logger.info(f"Query Rewritten: '{current_query}' -> '{rewritten}'")
        return rewritten
        
    except Exception as e:
        logger.error(f"Query rewriting failed: {e}. Falling back to original query.")
        return current_query
