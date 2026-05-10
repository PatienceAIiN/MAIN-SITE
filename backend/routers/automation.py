from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from database import AsyncDB

router = APIRouter(prefix="/api/automation", tags=["automation"])


# --- Request / Response Models ---

class ExecuteCommandRequest(BaseModel):
    command: str
    dry_run: bool = True


class TaskApproveRequest(BaseModel):
    notes: Optional[str] = None


class TaskRejectRequest(BaseModel):
    reason: Optional[str] = None


class ScheduleTaskRequest(BaseModel):
    command: str
    schedule: str  # cron expression or natural language
    name: Optional[str] = None
    enabled: bool = True


# --- Endpoints ---

@router.post("/execute")
async def execute_command(data: ExecuteCommandRequest):
    """Execute a natural language command. Parses, previews, and optionally executes."""
    try:
        db = AsyncDB()
    except ValueError:
        raise HTTPException(503, "Database not configured")

    try:
        from services import groq_service
        parsed = await groq_service.parse_command(data.command)
    except ImportError:
        parsed = {
            "intent": "unknown",
            "entities": {},
            "original_command": data.command,
        }
    except Exception as e:
        raise HTTPException(500, f"Failed to parse command: {str(e)}")

    task_row = {
        "command": data.command,
        "parsed": parsed,
        "status": "preview" if data.dry_run else "executing",
        "dry_run": data.dry_run,
    }
    result = await db.table("automation_tasks").insert(task_row).execute()
    task = result.data[0] if result.data else task_row

    if not data.dry_run:
        try:
            from services import automation_service
            execution_result = await automation_service.execute_task(task)
            await db.table("automation_tasks").update({
                "status": "completed",
                "result": execution_result,
            }).eq("id", task["id"]).execute()
            task["status"] = "completed"
            task["result"] = execution_result
        except ImportError:
            task["status"] = "pending_service"
        except Exception as e:
            await db.table("automation_tasks").update({
                "status": "failed",
                "error": str(e),
            }).eq("id", task["id"]).execute()
            task["status"] = "failed"
            task["error"] = str(e)

    return task


@router.get("/tasks")
async def list_tasks(
    status: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
):
    """List automation tasks with optional status filter."""
    try:
        db = AsyncDB()
    except ValueError:
        return []

    query = db.table("automation_tasks").select("*").order("created_at", desc=True).limit(limit).offset(offset)
    if status:
        query = query.eq("status", status)
    result = await query.execute()
    return result.data or []


@router.get("/tasks/{task_id}")
async def get_task(task_id: int):
    """Get details for a specific automation task."""
    try:
        db = AsyncDB()
    except ValueError:
        raise HTTPException(503, "Database not configured")

    task = await db.table("automation_tasks").select("*").eq("id", task_id).single().execute()
    if not task.data:
        raise HTTPException(404, "Task not found")
    return task.data


@router.post("/tasks/{task_id}/approve")
async def approve_task(task_id: int, data: TaskApproveRequest):
    """Approve a previewed task for execution."""
    try:
        db = AsyncDB()
    except ValueError:
        raise HTTPException(503, "Database not configured")

    task = await db.table("automation_tasks").select("*").eq("id", task_id).single().execute()
    if not task.data:
        raise HTTPException(404, "Task not found")
    if task.data.get("status") != "preview":
        raise HTTPException(400, "Task is not in preview status")

    await db.table("automation_tasks").update({"status": "approved"}).eq("id", task_id).execute()

    try:
        from services import automation_service
        execution_result = await automation_service.execute_task(task.data)
        await db.table("automation_tasks").update({
            "status": "completed",
            "result": execution_result,
            "approved_notes": data.notes,
        }).eq("id", task_id).execute()
        return {"status": "completed", "result": execution_result}
    except ImportError:
        await db.table("automation_tasks").update({
            "status": "approved",
            "approved_notes": data.notes,
        }).eq("id", task_id).execute()
        return {"status": "approved", "message": "Task approved, awaiting execution service"}
    except Exception as e:
        await db.table("automation_tasks").update({
            "status": "failed",
            "error": str(e),
        }).eq("id", task_id).execute()
        raise HTTPException(500, f"Task execution failed: {str(e)}")


@router.post("/tasks/{task_id}/reject")
async def reject_task(task_id: int, data: TaskRejectRequest):
    """Reject a previewed task."""
    try:
        db = AsyncDB()
    except ValueError:
        raise HTTPException(503, "Database not configured")

    task = await db.table("automation_tasks").select("*").eq("id", task_id).single().execute()
    if not task.data:
        raise HTTPException(404, "Task not found")

    await db.table("automation_tasks").update({
        "status": "rejected",
        "rejection_reason": data.reason,
    }).eq("id", task_id).execute()

    return {"status": "rejected", "task_id": task_id}


@router.post("/tasks/{task_id}/rollback")
async def rollback_task(task_id: int):
    """Rollback changes made by a completed task."""
    try:
        db = AsyncDB()
    except ValueError:
        raise HTTPException(503, "Database not configured")

    task = await db.table("automation_tasks").select("*").eq("id", task_id).single().execute()
    if not task.data:
        raise HTTPException(404, "Task not found")
    if task.data.get("status") != "completed":
        raise HTTPException(400, "Only completed tasks can be rolled back")

    try:
        from services import automation_service
        rollback_result = await automation_service.rollback_task(task.data)
        await db.table("automation_tasks").update({
            "status": "rolled_back",
            "rollback_result": rollback_result,
        }).eq("id", task_id).execute()
        return {"status": "rolled_back", "result": rollback_result}
    except ImportError:
        raise HTTPException(501, "Automation service not available")
    except Exception as e:
        raise HTTPException(500, f"Rollback failed: {str(e)}")


@router.get("/daily-report")
async def get_daily_report():
    """Get the latest daily automation report."""
    try:
        db = AsyncDB()
    except ValueError:
        return {"tasks_today": 0, "completed": 0, "failed": 0, "pending": 0}

    try:
        result = await (
            db.table("automation_reports")
            .select("*")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if result.data:
            return result.data[0]
    except Exception:
        pass

    tasks = await db.table("automation_tasks").select("*").execute()
    all_tasks = tasks.data or []

    return {
        "tasks_today": len(all_tasks),
        "completed": len([t for t in all_tasks if t.get("status") == "completed"]),
        "failed": len([t for t in all_tasks if t.get("status") == "failed"]),
        "pending": len([t for t in all_tasks if t.get("status") in ("preview", "approved")]),
    }


@router.post("/schedule")
async def schedule_task(data: ScheduleTaskRequest):
    """Schedule a task for recurring or future execution."""
    try:
        db = AsyncDB()
    except ValueError:
        raise HTTPException(503, "Database not configured")

    row = {
        "command": data.command,
        "schedule": data.schedule,
        "name": data.name or data.command[:100],
        "enabled": data.enabled,
        "status": "scheduled",
    }
    result = await db.table("scheduled_tasks").insert(row).execute()
    return result.data[0] if result.data else row
