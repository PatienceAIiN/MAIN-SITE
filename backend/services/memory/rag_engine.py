"""
RAG Engine - Retrieval-Augmented Generation knowledge system.

Ingests documents, chunks them, stores embeddings, and answers questions
by retrieving relevant chunks and generating answers via Groq.
"""

import os
import json
import uuid
import time
import logging
from typing import Any

import httpx

from backend.services.memory.vector_memory_service import (
    store_embedding,
    search_similar,
    delete_embedding as _delete_vector,
)

logger = logging.getLogger(__name__)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

RAG_COLLECTION = "rag_documents"
CHUNK_SIZE = 500  # characters per chunk
CHUNK_OVERLAP = 100  # overlap between chunks


async def _call_groq(messages: list[dict], temperature: float = 0.2) -> str:
    """Send a chat completion request to Groq."""
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": GROQ_MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": 2048,
    }
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(GROQ_URL, headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]


def _chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Split text into overlapping chunks."""
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        if chunk.strip():
            chunks.append(chunk.strip())
        start = end - overlap
    return chunks


async def ingest_document(content: str, source: str, doc_type: str, db: Any) -> dict:
    """
    Ingest a document by chunking it and storing embeddings.

    Args:
        content: Full text content of the document.
        source: Source identifier (URL, filename, etc.).
        doc_type: Type of document (blog, product, faq, policy, etc.).
        db: Supabase client instance.

    Returns:
        dict with doc_id, chunk_count, and status.
    """
    doc_id = str(uuid.uuid4())
    chunks = _chunk_text(content)

    if not chunks:
        return {"doc_id": doc_id, "status": "empty", "chunk_count": 0}

    chunk_ids: list[str] = []
    for idx, chunk in enumerate(chunks):
        metadata = {
            "doc_id": doc_id,
            "source": source,
            "doc_type": doc_type,
            "chunk_index": idx,
            "total_chunks": len(chunks),
        }
        embedding_id = await store_embedding(chunk, metadata, collection=RAG_COLLECTION)
        chunk_ids.append(embedding_id)

    # Persist document metadata in Supabase
    try:
        record = {
            "id": doc_id,
            "source": source,
            "doc_type": doc_type,
            "chunk_count": len(chunks),
            "chunk_ids": json.dumps(chunk_ids),
            "content_length": len(content),
            "created_at": time.time(),
        }
        db.table("rag_documents").insert(record).execute()
    except Exception as exc:
        logger.warning("Could not persist document metadata: %s", exc)

    logger.info("Ingested document %s: %d chunks from '%s'", doc_id, len(chunks), source)
    return {
        "doc_id": doc_id,
        "source": source,
        "doc_type": doc_type,
        "chunk_count": len(chunks),
        "status": "ingested",
    }


async def query_knowledge(question: str, db: Any) -> dict:
    """
    Answer a question using RAG: retrieve relevant chunks, then generate an answer.

    Args:
        question: The user's question.
        db: Supabase client instance.

    Returns:
        dict with answer, sources, and confidence.
    """
    # Step 1: Retrieve relevant chunks
    results = await search_similar(question, collection=RAG_COLLECTION, limit=5)

    if not results:
        return {
            "answer": "I don't have enough information to answer that question.",
            "sources": [],
            "confidence": "low",
        }

    # Step 2: Build context from retrieved chunks
    context_parts: list[str] = []
    sources: list[dict] = []
    for r in results:
        context_parts.append(r["text"])
        source_info = {
            "source": r["metadata"].get("source", "unknown"),
            "doc_type": r["metadata"].get("doc_type", "unknown"),
            "relevance_score": r["score"],
        }
        if source_info not in sources:
            sources.append(source_info)

    context = "\n---\n".join(context_parts)

    # Step 3: Generate answer via Groq
    prompt = (
        "Answer the following question using ONLY the provided context. "
        "If the context doesn't contain enough information, say so.\n\n"
        f"Context:\n{context}\n\n"
        f"Question: {question}"
    )

    try:
        answer = await _call_groq([
            {
                "role": "system",
                "content": (
                    "You are a knowledgeable marketing assistant. Answer questions "
                    "accurately based on the provided context. Be concise and helpful."
                ),
            },
            {"role": "user", "content": prompt},
        ])

        # Determine confidence based on relevance scores
        avg_score = sum(r["score"] for r in results) / len(results) if results else 0
        confidence = "high" if avg_score > 0.7 else "medium" if avg_score > 0.4 else "low"

        return {
            "answer": answer.strip(),
            "sources": sources,
            "confidence": confidence,
            "chunks_used": len(results),
        }
    except (httpx.HTTPStatusError, Exception) as exc:
        logger.error("RAG query failed: %s", exc)
        return {
            "answer": "An error occurred while generating the answer.",
            "sources": sources,
            "confidence": "none",
            "error": str(exc),
        }


async def list_documents(db: Any) -> list[dict]:
    """
    List all ingested documents.

    Args:
        db: Supabase client instance.

    Returns:
        List of document metadata dicts.
    """
    try:
        response = (
            db.table("rag_documents")
            .select("id, source, doc_type, chunk_count, content_length, created_at")
            .order("created_at", desc=True)
            .execute()
        )
        return response.data or []
    except Exception as exc:
        logger.error("Failed to list documents: %s", exc)
        return []


async def delete_document(doc_id: str, db: Any) -> dict:
    """
    Delete a document and all its chunks/embeddings.

    Args:
        doc_id: UUID of the document to delete.
        db: Supabase client instance.

    Returns:
        dict with deletion status.
    """
    try:
        # Fetch chunk IDs
        response = (
            db.table("rag_documents")
            .select("chunk_ids")
            .eq("id", doc_id)
            .single()
            .execute()
        )

        if not response.data:
            return {"doc_id": doc_id, "status": "not_found"}

        chunk_ids_raw = response.data.get("chunk_ids", "[]")
        if isinstance(chunk_ids_raw, str):
            chunk_ids = json.loads(chunk_ids_raw)
        else:
            chunk_ids = chunk_ids_raw

        # Delete embeddings from vector store
        deleted_count = 0
        for cid in chunk_ids:
            success = await _delete_vector(cid)
            if success:
                deleted_count += 1

        # Delete document record
        db.table("rag_documents").delete().eq("id", doc_id).execute()

        logger.info("Deleted document %s (%d chunks)", doc_id, deleted_count)
        return {
            "doc_id": doc_id,
            "status": "deleted",
            "chunks_deleted": deleted_count,
        }
    except Exception as exc:
        logger.error("Failed to delete document %s: %s", doc_id, exc)
        return {"doc_id": doc_id, "status": "error", "error": str(exc)}
