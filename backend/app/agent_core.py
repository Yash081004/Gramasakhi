# app/agent_core.py — Unified agentic reasoning for summarize / compare / report
from typing import List, Dict
from app.llm import call_llm, simple_answer_from_retrieval, long_form_summarize

def build_context(chunks: List[Dict], limit: int = 10):
    ctx = ""
    for i, c in enumerate(chunks[:limit], start=1):
        ctx += f"[{i}] {c.get('text','')}\n(Source: {c.get('source')}, chunk {c.get('chunk_id')})\n\n"
    return ctx

def run_agent(task: str, topic: str, chunks: List[Dict], model: str = "gpt") -> str:
    """
    task: summarize / compare / report
    topic: user input
    chunks: retrieved top chunks
    model: "gpt" | "llama" | "hybrid"
    """
    # For summarize and report with many chunks, use hierarchical long-form summarization
    if task == "summarize":
        if len(chunks) > 8:
            return long_form_summarize(topic, chunks, max_batch_chars=2500, model=model)

        context = build_context(chunks)
        prompt = f"""
You are DocuLex, an intelligent summarization agent.

Summarize the topic: '{topic}' using ONLY the provided context.
Give a structured, accurate, and citation-backed summary.

Context:
{context}

Output Format:
### Summary
- Key point 1
- Key point 2
- Key point 3

### Citations
- Source, chunk id
"""
        out = call_llm(prompt, model=model, max_tokens=900)
        if out:
            return out
        return simple_answer_from_retrieval(topic, chunks, model=model)

    elif task == "report":
        if len(chunks) > 8:
            long_summary = long_form_summarize(topic, chunks, max_batch_chars=2500, model=model)
            report_prompt = f"""
You are DocuLex, an academic report generator.
Take the following summary and structure it as a formal report:

Summary:
{long_summary}

Format the output as:
1. Introduction  
2. Detailed Explanation  
3. Findings / Insights  
4. Conclusion  
5. Citations  
"""
            final_report = call_llm(report_prompt, model=model, max_tokens=900)
            if final_report:
                return final_report
            return long_summary

        context = build_context(chunks)
        prompt = f"""
You are DocuLex, an academic report generator.

Generate a structured report on '{topic}' using ONLY the retrieved context.
Your report must include:

1. Introduction  
2. Detailed Explanation  
3. Findings / Insights  
4. Conclusion  
5. Citations  

Context:
{context}
"""
        out = call_llm(prompt, model=model, max_tokens=900)
        if out:
            return out
        return simple_answer_from_retrieval(topic, chunks, model=model)

    elif task == "compare":
        context = build_context(chunks)
        prompt = f"""
You are DocuLex, a comparative reasoning agent.

Compare the documents for the topic: '{topic}' using ONLY the given context.
Highlight:
- Similarities
- Differences
- Observations

Context:
{context}

Output Format:
### Similarities
- ...

### Differences
- ...

### Observations
- ...

### Citations
- File, chunk id
"""
        out = call_llm(prompt, model=model, max_tokens=900)
        if out:
            return out
        return simple_answer_from_retrieval(topic, chunks, model=model)

    else:
        return simple_answer_from_retrieval(topic, chunks, model=model)