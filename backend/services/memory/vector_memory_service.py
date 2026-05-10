"""
Vector Memory Service - In-memory vector storage with pgvector/Pinecone swap notes.

This implementation uses a simple in-memory dictionary store with cosine similarity
over lightweight embeddings. For production, swap to pgvector or Pinecone as noted
in the comments.
"""

import os
import uuid
import hashlib
import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

# ---------------------------------------------------------------------------
# In-memory vector store
# Each collection is a dict mapping embedding_id -> {text, metadata, vector}
#
# TO SWAP TO PGVECTOR:
#   1. Replace _store with a PostgreSQL connection using asyncpg
#   2. Create table: CREATE TABLE embeddings (
#        id UUID PRIMARY KEY, collection TEXT, text TEXT,
#        metadata JSONB, embedding vector(1536)
#      );
#   3. Replace store_embedding() to INSERT with real embeddings
#   4. Replace search_similar() to use <=> cosine distance operator
#   5. Install: pip install asyncpg pgvector
#
# TO SWAP TO PINECONE:
#   1. pip install pinecone-client
#   2. Initialize: pinecone.init(api_key=os.getenv("PINECONE_API_KEY"))
#   3. Replace store_embedding() with index.upsert()
#   4. Replace search_similar() with index.query()
#   5. Each collection maps to a Pinecone namespace
# ---------------------------------------------------------------------------

_store: dict[str, dict[str, dict]] = {}


def _get_collection(collection: str) -> dict[str, dict]:
    """Get or create a collection in the in-memory store."""
    if collection not in _store:
        _store[collection] = {}
    return _store[collection]


def _simple_hash_vector(text: str, dims: int = 128) -> list[float]:
    """
    Generate a deterministic pseudo-vector from text for similarity matching.
    This is NOT a real embedding -- it's a lightweight stand-in for development.
    Replace with a proper embedding model (e.g., sentence-transformers or
    OpenAI embeddings) for production use.
    """
    digest = hashlib.sha512(text.lower().encode()).hexdigest()
    # Convert hex pairs to floats in [0, 1]
    vector = []
    for i in range(0, min(len(digest), dims * 2), 2):
        vector.append(int(digest[i : i + 2], 16) / 255.0)
    # Pad if needed
    while len(vector) < dims:
        vector.append(0.0)
    return vector[:dims]


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    dot = sum(x * y for x, y in zip(a, b))
    mag_a = sum(x * x for x in a) ** 0.5
    mag_b = sum(x * x for x in b) ** 0.5
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


async def store_embedding(text: str, metadata: dict, collection: str = "default") -> str:
    """
    Store text with its embedding vector in the specified collection.

    Args:
        text: The text to embed and store.
        metadata: Arbitrary metadata dict to attach.
        collection: Logical collection/namespace name.

    Returns:
        The embedding_id (UUID string).
    """
    embedding_id = str(uuid.uuid4())
    vector = _simple_hash_vector(text)

    col = _get_collection(collection)
    col[embedding_id] = {
        "text": text,
        "metadata": metadata,
        "vector": vector,
    }

    logger.info(
        "Stored embedding %s in collection '%s' (%d chars)",
        embedding_id, collection, len(text),
    )
    return embedding_id


async def search_similar(
    query: str,
    collection: str = "default",
    limit: int = 5,
) -> list[dict]:
    """
    Perform semantic search within a collection.

    Args:
        query: Search query text.
        collection: Collection to search in.
        limit: Max results to return.

    Returns:
        List of dicts with embedding_id, text, metadata, score, sorted by relevance.
    """
    col = _get_collection(collection)
    if not col:
        return []

    query_vector = _simple_hash_vector(query)

    scored: list[tuple[str, float, dict]] = []
    for eid, entry in col.items():
        score = _cosine_similarity(query_vector, entry["vector"])
        scored.append((eid, score, entry))

    scored.sort(key=lambda x: x[1], reverse=True)

    results = []
    for eid, score, entry in scored[:limit]:
        results.append({
            "embedding_id": eid,
            "text": entry["text"],
            "metadata": entry["metadata"],
            "score": round(score, 4),
        })

    return results


async def delete_embedding(embedding_id: str) -> bool:
    """
    Delete an embedding by ID from any collection.

    Args:
        embedding_id: The UUID of the embedding to delete.

    Returns:
        True if found and deleted, False otherwise.
    """
    for collection_name, col in _store.items():
        if embedding_id in col:
            del col[embedding_id]
            logger.info(
                "Deleted embedding %s from collection '%s'",
                embedding_id, collection_name,
            )
            return True
    logger.warning("Embedding %s not found in any collection", embedding_id)
    return False
