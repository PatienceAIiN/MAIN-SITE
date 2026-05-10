"""
Site Memory Engine - Stores and retrieves website and product data.
"""

import json
import uuid
import time
import logging
from typing import Any

from backend.services.memory.vector_memory_service import (
    store_embedding,
    search_similar,
)

logger = logging.getLogger(__name__)

PRODUCTS_COLLECTION = "site_products"
PAGES_COLLECTION = "site_pages"


async def store_product(product_data: dict, db: Any) -> dict:
    """
    Store or update a product in memory and Supabase.

    Args:
        product_data: Dict with at minimum: name, description.
            Optional: price, category, url, images, sku, variants, tags.
        db: Supabase client instance.

    Returns:
        dict with product_id and status.
    """
    product_id = product_data.get("id", str(uuid.uuid4()))
    name = product_data.get("name", "")
    description = product_data.get("description", "")

    # Build searchable text for vector storage
    searchable_text = f"{name}. {description}"
    tags = product_data.get("tags", [])
    if tags:
        searchable_text += f" Tags: {', '.join(tags)}"
    category = product_data.get("category", "")
    if category:
        searchable_text += f" Category: {category}"

    # Store in vector memory for semantic search
    metadata = {
        "product_id": product_id,
        "name": name,
        "category": category,
        "price": product_data.get("price"),
        "url": product_data.get("url", ""),
    }
    await store_embedding(searchable_text, metadata, collection=PRODUCTS_COLLECTION)

    # Persist full product data in Supabase
    try:
        record = {
            "id": product_id,
            "name": name,
            "description": description,
            "price": product_data.get("price"),
            "category": category,
            "url": product_data.get("url", ""),
            "sku": product_data.get("sku", ""),
            "images": json.dumps(product_data.get("images", [])),
            "variants": json.dumps(product_data.get("variants", [])),
            "tags": json.dumps(tags),
            "raw_data": json.dumps(product_data),
            "updated_at": time.time(),
        }
        db.table("products").upsert(record).execute()
        logger.info("Stored product %s: %s", product_id, name)
        return {"product_id": product_id, "name": name, "status": "stored"}
    except Exception as exc:
        logger.error("Failed to store product: %s", exc)
        return {"product_id": product_id, "status": "error", "error": str(exc)}


async def store_page(page_data: dict, db: Any) -> dict:
    """
    Store or update a website page in memory and Supabase.

    Args:
        page_data: Dict with at minimum: url, title, content.
            Optional: meta_description, page_type, headings, links.
        db: Supabase client instance.

    Returns:
        dict with page_id and status.
    """
    page_id = page_data.get("id", str(uuid.uuid4()))
    url = page_data.get("url", "")
    title = page_data.get("title", "")
    content = page_data.get("content", "")

    # Build searchable text
    searchable_text = f"{title}. {content[:1000]}"
    meta = page_data.get("meta_description", "")
    if meta:
        searchable_text += f" {meta}"

    # Store in vector memory
    metadata = {
        "page_id": page_id,
        "url": url,
        "title": title,
        "page_type": page_data.get("page_type", "unknown"),
    }
    await store_embedding(searchable_text, metadata, collection=PAGES_COLLECTION)

    # Persist in Supabase
    try:
        record = {
            "id": page_id,
            "url": url,
            "title": title,
            "content": content[:10000],  # Cap stored content
            "meta_description": meta,
            "page_type": page_data.get("page_type", "unknown"),
            "headings": json.dumps(page_data.get("headings", [])),
            "links": json.dumps(page_data.get("links", [])),
            "raw_data": json.dumps(page_data),
            "updated_at": time.time(),
        }
        db.table("pages").upsert(record).execute()
        logger.info("Stored page %s: %s", page_id, title)
        return {"page_id": page_id, "url": url, "title": title, "status": "stored"}
    except Exception as exc:
        logger.error("Failed to store page: %s", exc)
        return {"page_id": page_id, "status": "error", "error": str(exc)}


async def search_products(query: str, db: Any) -> list[dict]:
    """
    Semantic search across stored products.

    Args:
        query: Natural language search query.
        db: Supabase client instance (available for additional filtering).

    Returns:
        List of matching product dicts with relevance scores.
    """
    results = await search_similar(query, collection=PRODUCTS_COLLECTION, limit=10)

    enriched: list[dict] = []
    for r in results:
        product_id = r["metadata"].get("product_id", "")
        entry = {
            "product_id": product_id,
            "name": r["metadata"].get("name", ""),
            "category": r["metadata"].get("category", ""),
            "price": r["metadata"].get("price"),
            "url": r["metadata"].get("url", ""),
            "relevance_score": r["score"],
            "snippet": r["text"][:200],
        }
        enriched.append(entry)

    return enriched


async def get_product_context(product_id: str, db: Any) -> dict:
    """
    Get full context for a product including stored data and related items.

    Args:
        product_id: UUID of the product.
        db: Supabase client instance.

    Returns:
        dict with product details, related products, and associated pages.
    """
    try:
        # Fetch product from Supabase
        response = (
            db.table("products")
            .select("*")
            .eq("id", product_id)
            .single()
            .execute()
        )

        if not response.data:
            return {"product_id": product_id, "status": "not_found"}

        product = response.data

        # Parse JSON fields
        for field in ("images", "variants", "tags"):
            if isinstance(product.get(field), str):
                try:
                    product[field] = json.loads(product[field])
                except json.JSONDecodeError:
                    pass

        # Find related products via semantic search
        name = product.get("name", "")
        description = product.get("description", "")
        related = await search_similar(
            f"{name} {description[:200]}",
            collection=PRODUCTS_COLLECTION,
            limit=4,
        )
        related_products = [
            {
                "product_id": r["metadata"].get("product_id", ""),
                "name": r["metadata"].get("name", ""),
                "relevance_score": r["score"],
            }
            for r in related
            if r["metadata"].get("product_id") != product_id
        ]

        # Find associated pages
        associated_pages = await search_similar(
            name,
            collection=PAGES_COLLECTION,
            limit=3,
        )
        pages = [
            {
                "page_id": p["metadata"].get("page_id", ""),
                "url": p["metadata"].get("url", ""),
                "title": p["metadata"].get("title", ""),
                "relevance_score": p["score"],
            }
            for p in associated_pages
        ]

        return {
            "product": product,
            "related_products": related_products,
            "associated_pages": pages,
            "status": "found",
        }
    except Exception as exc:
        logger.error("Failed to get product context for %s: %s", product_id, exc)
        return {"product_id": product_id, "status": "error", "error": str(exc)}
