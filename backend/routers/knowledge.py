from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from database import AsyncDB

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])


# --- Request / Response Models ---

class IngestRequest(BaseModel):
    content: str
    title: Optional[str] = None
    source: Optional[str] = None
    doc_type: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class QueryRequest(BaseModel):
    question: str
    top_k: int = 5
    filters: Optional[Dict[str, Any]] = None


class QueryResponse(BaseModel):
    answer: str
    sources: List[Dict[str, Any]]
    confidence: float


# --- Endpoints ---

@router.post("/ingest")
async def ingest_document(data: IngestRequest):
    """Ingest a document into the knowledge base for RAG retrieval."""
    try:
        db = AsyncDB()
    except ValueError:
        raise HTTPException(503, "Database not configured")

    try:
        from services import knowledge_service
        result = await knowledge_service.ingest(
            content=data.content,
            title=data.title,
            source=data.source,
            doc_type=data.doc_type,
            metadata=data.metadata,
        )
        return result
    except ImportError:
        row = {
            "content": data.content,
            "title": data.title or "Untitled",
            "source": data.source,
            "doc_type": data.doc_type or "text",
            "metadata": data.metadata or {},
            "status": "ingested",
        }
        result = await db.table("knowledge_documents").insert(row).execute()
        return result.data[0] if result.data else row


@router.post("/query")
async def query_knowledge(data: QueryRequest):
    """Ask a question against the knowledge base using RAG."""
    try:
        db = AsyncDB()
    except ValueError:
        raise HTTPException(503, "Database not configured")

    try:
        from services import knowledge_service
        result = await knowledge_service.query(
            question=data.question,
            top_k=data.top_k,
            filters=data.filters,
        )
        return result
    except ImportError:
        documents = await db.table("knowledge_documents").select("*").execute()
        return {
            "answer": "Knowledge service not configured. Documents are stored but RAG retrieval requires the knowledge service.",
            "sources": [],
            "confidence": 0.0,
            "document_count": len(documents.data or []),
        }
    except Exception as e:
        raise HTTPException(500, f"Query failed: {str(e)}")


@router.get("/documents")
async def list_documents(
    doc_type: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
):
    """List all documents in the knowledge base."""
    try:
        db = AsyncDB()
    except ValueError:
        return []

    query = db.table("knowledge_documents").select("id,title,source,doc_type,status,created_at").order("created_at", desc=True).limit(limit).offset(offset)
    if doc_type:
        query = query.eq("doc_type", doc_type)
    result = await query.execute()
    return result.data or []


@router.delete("/documents/{document_id}")
async def delete_document(document_id: int):
    """Delete a document from the knowledge base."""
    try:
        db = AsyncDB()
    except ValueError:
        raise HTTPException(503, "Database not configured")

    existing = await db.table("knowledge_documents").select("id").eq("id", document_id).single().execute()
    if not existing.data:
        raise HTTPException(404, "Document not found")

    try:
        from services import knowledge_service
        await knowledge_service.delete_document(document_id)
    except ImportError:
        pass

    await db.table("knowledge_documents").delete().eq("id", document_id).execute()
    return {"status": "deleted", "id": document_id}
