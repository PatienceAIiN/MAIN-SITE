"""
n8n Workflow Service - Trigger, monitor, and list n8n workflows.
"""

import os
import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

N8N_URL_DEFAULT = os.getenv("N8N_URL", "http://localhost:5678")
N8N_API_KEY = os.getenv("N8N_API_KEY", "")


def _get_headers() -> dict[str, str]:
    """Build request headers for n8n API calls."""
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if N8N_API_KEY:
        headers["X-N8N-API-KEY"] = N8N_API_KEY
    return headers


async def trigger_workflow(
    workflow_id: str,
    payload: dict,
    n8n_url: str | None = None,
) -> dict:
    """
    Trigger an n8n workflow via its webhook endpoint.

    Args:
        workflow_id: The n8n workflow ID or webhook path.
        payload: Data to send to the workflow.
        n8n_url: Override for the n8n base URL. Defaults to N8N_URL env var.

    Returns:
        dict with execution status and response data.
    """
    base = n8n_url or N8N_URL_DEFAULT
    url = f"{base}/webhook/{workflow_id}"

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(url, headers=_get_headers(), json=payload)
            resp.raise_for_status()
            data = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {"raw": resp.text}

            logger.info("Triggered workflow %s: status %d", workflow_id, resp.status_code)
            return {
                "workflow_id": workflow_id,
                "status": "triggered",
                "http_status": resp.status_code,
                "response": data,
            }
    except httpx.TimeoutException:
        logger.error("Timeout triggering workflow %s", workflow_id)
        return {"workflow_id": workflow_id, "status": "timeout", "error": "Request timed out"}
    except httpx.HTTPStatusError as exc:
        logger.error("HTTP error triggering workflow %s: %s", workflow_id, exc)
        return {
            "workflow_id": workflow_id,
            "status": "error",
            "http_status": exc.response.status_code,
            "error": str(exc),
        }
    except Exception as exc:
        logger.error("Failed to trigger workflow %s: %s", workflow_id, exc)
        return {"workflow_id": workflow_id, "status": "error", "error": str(exc)}


async def get_workflow_status(
    execution_id: str,
    n8n_url: str | None = None,
) -> dict:
    """
    Get the status of a specific workflow execution.

    Args:
        execution_id: The n8n execution ID.
        n8n_url: Override for the n8n base URL.

    Returns:
        dict with execution details.
    """
    base = n8n_url or N8N_URL_DEFAULT
    url = f"{base}/api/v1/executions/{execution_id}"

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url, headers=_get_headers())
            resp.raise_for_status()
            data = resp.json()

            return {
                "execution_id": execution_id,
                "status": data.get("status", "unknown"),
                "finished": data.get("finished", False),
                "started_at": data.get("startedAt"),
                "stopped_at": data.get("stoppedAt"),
                "workflow_id": data.get("workflowId"),
                "data": data.get("data"),
            }
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 404:
            return {"execution_id": execution_id, "status": "not_found"}
        logger.error("HTTP error fetching execution %s: %s", execution_id, exc)
        return {"execution_id": execution_id, "status": "error", "error": str(exc)}
    except Exception as exc:
        logger.error("Failed to get execution status %s: %s", execution_id, exc)
        return {"execution_id": execution_id, "status": "error", "error": str(exc)}


async def list_workflows(n8n_url: str | None = None) -> list[dict]:
    """
    List all workflows configured in n8n.

    Args:
        n8n_url: Override for the n8n base URL.

    Returns:
        List of workflow summary dicts.
    """
    base = n8n_url or N8N_URL_DEFAULT
    url = f"{base}/api/v1/workflows"

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url, headers=_get_headers())
            resp.raise_for_status()
            data = resp.json()

            workflows = data.get("data", data) if isinstance(data, dict) else data
            if not isinstance(workflows, list):
                workflows = [workflows]

            return [
                {
                    "id": w.get("id"),
                    "name": w.get("name", "Unnamed"),
                    "active": w.get("active", False),
                    "created_at": w.get("createdAt"),
                    "updated_at": w.get("updatedAt"),
                    "tags": [t.get("name", "") for t in w.get("tags", [])],
                }
                for w in workflows
            ]
    except Exception as exc:
        logger.error("Failed to list workflows: %s", exc)
        return []
