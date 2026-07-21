# agents.py — thin wrappers around agent_core
from typing import List, Dict
from app.agent_core import run_agent

def summarize_agent(topic: str, chunks: List[Dict], model: str = "gpt"):
    return run_agent("summarize", topic, chunks, model=model)

def compare_agent(topic: str, chunks: List[Dict], model: str = "gpt"):
    return run_agent("compare", topic, chunks, model=model)

def report_agent(topic: str, chunks: List[Dict], model: str = "gpt"):
    return run_agent("report", topic, chunks, model=model)
