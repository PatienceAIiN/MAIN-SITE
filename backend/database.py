"""
Database layer — NeonDB/PostgreSQL via asyncpg.
Provides a Supabase-compatible query builder so all router code stays unchanged.
"""
import os
import json
import asyncio
import asyncpg
from typing import Any, Optional
from dotenv import load_dotenv

load_dotenv()

_pool: asyncpg.Pool | None = None


# ---------------------------------------------------------------------------
# Connection pool
# ---------------------------------------------------------------------------

async def _get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        dsn = os.getenv("DATABASE_URL", "")
        if not dsn:
            raise ValueError("DATABASE_URL not set")
        _pool = await asyncpg.create_pool(
            dsn,
            min_size=2,
            max_size=10,
            command_timeout=30,
            # asyncpg type coders for JSONB
            init=_init_conn,
        )
    return _pool


async def _init_conn(conn: asyncpg.Connection):
    await conn.set_type_codec(
        "jsonb",
        encoder=json.dumps,
        decoder=json.loads,
        schema="pg_catalog",
    )
    await conn.set_type_codec(
        "json",
        encoder=json.dumps,
        decoder=json.loads,
        schema="pg_catalog",
    )


def _run(coro):
    """Run async from sync context (startup only)."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
                fut = ex.submit(asyncio.run, coro)
                return fut.result(timeout=10)
        return loop.run_until_complete(coro)
    except Exception as e:
        print(f"DB run error: {e}")
        return None


# ---------------------------------------------------------------------------
# Supabase-compatible query builder
# ---------------------------------------------------------------------------

class QueryResult:
    def __init__(self, data: list):
        self.data = data


class QueryBuilder:
    """Minimal Supabase-compatible fluent query builder over asyncpg."""

    def __init__(self, table: str, pool: asyncpg.Pool):
        self._table = table
        self._pool = pool
        self._action = "select"
        self._columns = "*"
        self._filters: list[tuple] = []
        self._order_col: str | None = None
        self._order_desc = False
        self._limit_n: int | None = None
        self._single = False
        self._upsert = False
        self._payload: dict | None = None

    # --- Chainable methods ---

    def select(self, cols="*"):
        self._columns = cols
        self._action = "select"
        return self

    def insert(self, payload: dict):
        self._action = "insert"
        self._payload = payload
        return self

    def update(self, payload: dict):
        self._action = "update"
        self._payload = payload
        return self

    def delete(self):
        self._action = "delete"
        return self

    def upsert(self, payload: dict, on_conflict: str = "id"):
        self._action = "upsert"
        self._payload = payload
        self._upsert_conflict = on_conflict
        return self

    def eq(self, col: str, val: Any):
        self._filters.append(("eq", col, val))
        return self

    def neq(self, col: str, val: Any):
        self._filters.append(("neq", col, val))
        return self

    def ilike(self, col: str, pattern: str):
        self._filters.append(("ilike", col, pattern))
        return self

    def gte(self, col: str, val: Any):
        self._filters.append(("gte", col, val))
        return self

    def lte(self, col: str, val: Any):
        self._filters.append(("lte", col, val))
        return self

    def order(self, col: str, desc: bool = False):
        self._order_col = col
        self._order_desc = desc
        return self

    def limit(self, n: int):
        self._limit_n = n
        return self

    def single(self):
        self._single = True
        self._limit_n = 1
        return self

    # --- WHERE clause builder ---

    def _build_where(self, start_idx: int = 1) -> tuple[str, list]:
        if not self._filters:
            return "", []
        clauses, vals, idx = [], [], start_idx
        for op, col, val in self._filters:
            safe_col = f'"{col}"'
            if op == "eq":
                clauses.append(f"{safe_col} = ${idx}")
            elif op == "neq":
                clauses.append(f"{safe_col} != ${idx}")
            elif op == "ilike":
                clauses.append(f"{safe_col} ILIKE ${idx}")
            elif op == "gte":
                clauses.append(f"{safe_col} >= ${idx}")
            elif op == "lte":
                clauses.append(f"{safe_col} <= ${idx}")
            vals.append(val)
            idx += 1
        return " WHERE " + " AND ".join(clauses), vals

    # --- Execute ---

    async def _async_execute(self) -> QueryResult:
        pool = self._pool
        try:
            async with pool.acquire() as conn:
                if self._action == "select":
                    where, vals = self._build_where(1)
                    order = ""
                    if self._order_col:
                        direction = "DESC" if self._order_desc else "ASC"
                        order = f' ORDER BY "{self._order_col}" {direction}'
                    lim = f" LIMIT {self._limit_n}" if self._limit_n else ""
                    sql = f'SELECT {self._columns} FROM "{self._table}"{where}{order}{lim}'
                    rows = await conn.fetch(sql, *vals)
                    data = [dict(r) for r in rows]
                    if self._single:
                        return QueryResult(data[0] if data else None)
                    return QueryResult(data)

                elif self._action == "insert":
                    payload = self._payload or {}
                    cols = ", ".join(f'"{k}"' for k in payload)
                    placeholders = ", ".join(f"${i+1}" for i in range(len(payload)))
                    sql = f'INSERT INTO "{self._table}" ({cols}) VALUES ({placeholders}) RETURNING *'
                    row = await conn.fetchrow(sql, *payload.values())
                    return QueryResult([dict(row)] if row else [])

                elif self._action == "update":
                    payload = self._payload or {}
                    set_parts = ", ".join(f'"{k}" = ${i+1}' for i, k in enumerate(payload))
                    where, where_vals = self._build_where(len(payload) + 1)
                    sql = f'UPDATE "{self._table}" SET {set_parts}{where} RETURNING *'
                    rows = await conn.fetch(sql, *list(payload.values()) + where_vals)
                    return QueryResult([dict(r) for r in rows])

                elif self._action == "delete":
                    where, vals = self._build_where(1)
                    sql = f'DELETE FROM "{self._table}"{where} RETURNING id'
                    rows = await conn.fetch(sql, *vals)
                    return QueryResult([dict(r) for r in rows])

                elif self._action == "upsert":
                    payload = self._payload or {}
                    cols = ", ".join(f'"{k}"' for k in payload)
                    placeholders = ", ".join(f"${i+1}" for i in range(len(payload)))
                    conflict = getattr(self, "_upsert_conflict", "id")
                    updates = ", ".join(f'"{k}" = EXCLUDED."{k}"' for k in payload if k != conflict)
                    sql = (
                        f'INSERT INTO "{self._table}" ({cols}) VALUES ({placeholders}) '
                        f'ON CONFLICT ("{conflict}") DO UPDATE SET {updates} RETURNING *'
                    )
                    row = await conn.fetchrow(sql, *payload.values())
                    return QueryResult([dict(row)] if row else [])

        except Exception as e:
            print(f"DB error [{self._action} {self._table}]: {e}")
            return QueryResult([])

    def execute(self) -> QueryResult:
        """Sync execute — wraps async for compatibility with sync callers."""
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # Inside async context (FastAPI) — return a coroutine
                raise _AsyncNeeded(self._async_execute())
            return loop.run_until_complete(self._async_execute())
        except _AsyncNeeded:
            raise


class _AsyncNeeded(Exception):
    def __init__(self, coro):
        self.coro = coro


class SupabaseCompat:
    """Thin wrapper so existing code `db.table(...).select(...).eq(...).execute()` works."""

    def __init__(self, pool: asyncpg.Pool):
        self._pool = pool

    def table(self, name: str) -> QueryBuilder:
        return QueryBuilder(name, self._pool)


# ---------------------------------------------------------------------------
# Public interface (matches the Supabase client interface)
# ---------------------------------------------------------------------------

_compat: SupabaseCompat | None = None


async def _ensure_pool() -> SupabaseCompat:
    global _compat
    if _compat is None:
        pool = await _get_pool()
        _compat = SupabaseCompat(pool)
    return _compat


def get_supabase() -> "AsyncDB":
    """Returns async-aware DB handle. Use `await db.table(...).execute_async()` in async code."""
    dsn = os.getenv("DATABASE_URL", "")
    if not dsn:
        raise ValueError("DATABASE_URL not set")
    return AsyncDB()


def reset_supabase():
    global _pool, _compat
    if _pool:
        _run(_pool.close())
    _pool = None
    _compat = None


class AsyncDB:
    """Async-first DB client. In FastAPI routes use `await db.table(...).execute_async()`."""

    def table(self, name: str) -> "AsyncQueryBuilder":
        return AsyncQueryBuilder(name)


class AsyncQueryBuilder:
    """Fully async query builder — used in all FastAPI endpoints."""

    def __init__(self, table: str):
        self._table = table
        self._action = "select"
        self._columns = "*"
        self._filters: list[tuple] = []
        self._order_col: str | None = None
        self._order_desc = False
        self._limit_n: int | None = None
        self._offset_n: int | None = None
        self._single_row = False
        self._payload: dict | None = None
        self._upsert_conflict = "id"

    def select(self, cols="*"):
        self._columns = cols
        self._action = "select"
        return self

    def insert(self, payload: dict):
        self._action = "insert"
        self._payload = payload
        return self

    def update(self, payload: dict):
        self._action = "update"
        self._payload = payload
        return self

    def delete(self):
        self._action = "delete"
        return self

    def upsert(self, payload: dict, on_conflict: str = "key"):
        self._action = "upsert"
        self._payload = payload
        self._upsert_conflict = on_conflict
        return self

    def eq(self, col: str, val: Any):
        self._filters.append(("eq", col, val))
        return self

    def neq(self, col: str, val: Any):
        self._filters.append(("neq", col, val))
        return self

    def ilike(self, col: str, pattern: str):
        self._filters.append(("ilike", col, pattern))
        return self

    def gte(self, col: str, val: Any):
        self._filters.append(("gte", col, val))
        return self

    def lte(self, col: str, val: Any):
        self._filters.append(("lte", col, val))
        return self

    def order(self, col: str, desc: bool = False):
        self._order_col = col
        self._order_desc = desc
        return self

    def limit(self, n: int):
        self._limit_n = n
        return self

    def single(self):
        self._single_row = True
        self._limit_n = 1
        return self

    def range(self, start: int, end: int):
        self._offset_n = start
        self._limit_n = end - start + 1
        return self

    def offset(self, n: int):
        self._offset_n = n
        return self

    def _build_where(self, start: int = 1) -> tuple[str, list]:
        if not self._filters:
            return "", []
        clauses, vals, idx = [], [], start
        for op, col, val in self._filters:
            sc = f'"{col}"'
            if op == "eq":
                clauses.append(f"{sc} = ${idx}")
            elif op == "neq":
                clauses.append(f"{sc} != ${idx}")
            elif op == "ilike":
                clauses.append(f"{sc} ILIKE ${idx}")
            elif op == "gte":
                clauses.append(f"{sc} >= ${idx}")
            elif op == "lte":
                clauses.append(f"{sc} <= ${idx}")
            vals.append(val)
            idx += 1
        return " WHERE " + " AND ".join(clauses), vals

    async def execute(self) -> QueryResult:
        pool = await _get_pool()
        try:
            async with pool.acquire() as conn:
                if self._action == "select":
                    where, vals = self._build_where(1)
                    order = (
                        f' ORDER BY "{self._order_col}" {"DESC" if self._order_desc else "ASC"}'
                        if self._order_col else ""
                    )
                    lim = f" LIMIT {self._limit_n}" if self._limit_n else ""
                    off = f" OFFSET {self._offset_n}" if self._offset_n else ""
                    sql = f'SELECT {self._columns} FROM "{self._table}"{where}{order}{lim}{off}'
                    rows = await conn.fetch(sql, *vals)
                    data = [dict(r) for r in rows]
                    if self._single_row:
                        return QueryResult(data[0] if data else None)
                    return QueryResult(data)

                elif self._action == "insert":
                    p = self._payload or {}
                    if not p:
                        return QueryResult([])
                    cols = ", ".join(f'"{k}"' for k in p)
                    ph = ", ".join(f"${i+1}" for i in range(len(p)))
                    sql = f'INSERT INTO "{self._table}" ({cols}) VALUES ({ph}) RETURNING *'
                    row = await conn.fetchrow(sql, *p.values())
                    return QueryResult([dict(row)] if row else [])

                elif self._action == "update":
                    p = self._payload or {}
                    if not p:
                        return QueryResult([])
                    sets = ", ".join(f'"{k}" = ${i+1}' for i, k in enumerate(p))
                    where, wvals = self._build_where(len(p) + 1)
                    sql = f'UPDATE "{self._table}" SET {sets}{where} RETURNING *'
                    rows = await conn.fetch(sql, *list(p.values()) + wvals)
                    return QueryResult([dict(r) for r in rows])

                elif self._action == "delete":
                    where, vals = self._build_where(1)
                    sql = f'DELETE FROM "{self._table}"{where} RETURNING id'
                    rows = await conn.fetch(sql, *vals)
                    return QueryResult([dict(r) for r in rows])

                elif self._action == "upsert":
                    p = self._payload or {}
                    if not p:
                        return QueryResult([])
                    cols = ", ".join(f'"{k}"' for k in p)
                    ph = ", ".join(f"${i+1}" for i in range(len(p)))
                    conflict = self._upsert_conflict
                    updates = ", ".join(
                        f'"{k}" = EXCLUDED."{k}"' for k in p if k != conflict
                    )
                    sql = (
                        f'INSERT INTO "{self._table}" ({cols}) VALUES ({ph}) '
                        f'ON CONFLICT ("{conflict}") DO UPDATE SET {updates} RETURNING *'
                    )
                    row = await conn.fetchrow(sql, *p.values())
                    return QueryResult([dict(row)] if row else [])

        except Exception as e:
            print(f"DB [{self._action} {self._table}]: {e}")
            return QueryResult([] if not self._single_row else None)


# ---------------------------------------------------------------------------
# Schema init & seeding
# ---------------------------------------------------------------------------

async def _async_init_db():
    try:
        pool = await _get_pool()
    except ValueError as e:
        print(f"DB not configured: {e}")
        return

    schema_sql = """
    CREATE TABLE IF NOT EXISTS content (
        id BIGSERIAL PRIMARY KEY, date TEXT NOT NULL, platform TEXT NOT NULL,
        topic TEXT, hook TEXT, body TEXT, cta TEXT, image_url TEXT,
        image_description TEXT, posted BOOLEAN DEFAULT FALSE,
        post_id TEXT, post_url TEXT, engagement JSONB,
        viral_score FLOAT, emotional_score FLOAT, channel_metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS messages (
        id BIGSERIAL PRIMARY KEY,
        conversation_id BIGINT,
        platform TEXT,
        channel TEXT,
        customer_id TEXT,
        direction TEXT DEFAULT 'inbound',
        message TEXT,
        recipient TEXT,
        sentiment FLOAT,
        confidence FLOAT,
        auto_reply TEXT,
        status TEXT DEFAULT 'received',
        metadata JSONB DEFAULT '{}',
        admin_review BOOLEAN DEFAULT FALSE,
        replied BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS config (
        id BIGSERIAL PRIMARY KEY, key TEXT UNIQUE NOT NULL, value TEXT
    );
    CREATE TABLE IF NOT EXISTS customers (
        id BIGSERIAL PRIMARY KEY, email TEXT, name TEXT, phone TEXT,
        social_handles JSONB DEFAULT '{}', lead_score INT DEFAULT 0,
        lead_stage TEXT DEFAULT 'new', tags JSONB DEFAULT '[]',
        metadata JSONB DEFAULT '{}',
        first_seen_at TIMESTAMPTZ DEFAULT NOW(),
        last_active_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS conversations (
        id BIGSERIAL PRIMARY KEY,
        customer_id BIGINT,
        channel TEXT NOT NULL,
        customer_email TEXT,
        customer_name TEXT,
        direction TEXT,
        message TEXT,
        ai_response TEXT,
        sentiment FLOAT,
        confidence FLOAT,
        metadata JSONB DEFAULT '{}',
        status TEXT DEFAULT 'new',
        requires_review BOOLEAN DEFAULT FALSE,
        reviewed BOOLEAN DEFAULT FALSE,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS pipeline (
        id BIGSERIAL PRIMARY KEY, customer_id BIGINT, stage TEXT DEFAULT 'lead',
        deal_value FLOAT DEFAULT 0, probability FLOAT DEFAULT 0, notes TEXT,
        next_action TEXT, next_action_date TIMESTAMPTZ, assigned_to TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS tasks (
        id BIGSERIAL PRIMARY KEY, type TEXT NOT NULL, title TEXT,
        description TEXT, status TEXT DEFAULT 'pending', priority TEXT DEFAULT 'medium',
        input_data JSONB DEFAULT '{}', output_data JSONB, preview_data JSONB,
        approved BOOLEAN DEFAULT FALSE, error TEXT,
        started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ,
        scheduled_for TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS knowledge_docs (
        id BIGSERIAL PRIMARY KEY, title TEXT, source TEXT, doc_type TEXT,
        content TEXT, chunks JSONB DEFAULT '[]', metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS products (
        id BIGSERIAL PRIMARY KEY, external_id TEXT, source TEXT,
        name TEXT NOT NULL, description TEXT, price FLOAT, currency TEXT DEFAULT 'USD',
        url TEXT, image_url TEXT, seo_score FLOAT, seo_suggestions JSONB,
        metadata JSONB DEFAULT '{}',
        synced_at TIMESTAMPTZ DEFAULT NOW(), created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS pages (
        id BIGSERIAL PRIMARY KEY, external_id TEXT, source TEXT,
        title TEXT NOT NULL, url TEXT, page_type TEXT, content_hash TEXT,
        seo_score FLOAT, seo_suggestions JSONB, metadata JSONB DEFAULT '{}',
        synced_at TIMESTAMPTZ DEFAULT NOW(), created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS contact_submissions (
        id BIGSERIAL PRIMARY KEY, name TEXT, email TEXT, phone TEXT,
        subject TEXT, message TEXT, source TEXT, intent TEXT,
        lead_score INT DEFAULT 0, auto_reply TEXT, customer_id BIGINT,
        processed BOOLEAN DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS workflow_executions (
        id BIGSERIAL PRIMARY KEY, workflow_id TEXT, workflow_name TEXT,
        trigger_type TEXT, trigger_data JSONB, status TEXT DEFAULT 'running',
        result JSONB, error TEXT,
        started_at TIMESTAMPTZ DEFAULT NOW(), completed_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS automation_logs (
        id BIGSERIAL PRIMARY KEY, service TEXT NOT NULL, action TEXT NOT NULL,
        level TEXT DEFAULT 'info', message TEXT, metadata JSONB DEFAULT '{}',
        duration_ms INT, token_count INT, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS escalations (
        id BIGSERIAL PRIMARY KEY, type TEXT, source TEXT, source_id BIGINT,
        urgency TEXT DEFAULT 'medium', title TEXT, description TEXT,
        assigned_to TEXT, context JSONB DEFAULT '{}', metadata JSONB DEFAULT '{}',
        customer_id BIGINT, status TEXT DEFAULT 'open', resolved_by TEXT,
        resolution TEXT, resolved_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS webhooks (
        id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL,
        callback_url TEXT NOT NULL, events JSONB DEFAULT '[]',
        active BOOLEAN DEFAULT TRUE, secret TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS automation_tasks (
        id BIGSERIAL PRIMARY KEY, command TEXT, parsed JSONB DEFAULT '{}',
        status TEXT DEFAULT 'preview', dry_run BOOLEAN DEFAULT TRUE,
        result JSONB, error TEXT, approved_notes TEXT, rejection_reason TEXT,
        rollback_result JSONB, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS scheduled_tasks (
        id BIGSERIAL PRIMARY KEY, command TEXT, schedule TEXT, name TEXT,
        enabled BOOLEAN DEFAULT TRUE, status TEXT DEFAULT 'scheduled',
        last_run TIMESTAMPTZ, next_run TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS automation_reports (
        id BIGSERIAL PRIMARY KEY, tasks_today INT DEFAULT 0, completed INT DEFAULT 0,
        failed INT DEFAULT 0, pending INT DEFAULT 0, metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS knowledge_documents (
        id BIGSERIAL PRIMARY KEY, title TEXT, source TEXT, doc_type TEXT DEFAULT 'text',
        content TEXT, metadata JSONB DEFAULT '{}', status TEXT DEFAULT 'ingested',
        created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS analytics_insights (
        id BIGSERIAL PRIMARY KEY, insights JSONB DEFAULT '[]',
        generated_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS escalation_activity (
        id BIGSERIAL PRIMARY KEY, escalation_id BIGINT, action TEXT,
        details TEXT, notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS webhook_events (
        id BIGSERIAL PRIMARY KEY, source TEXT, event_type TEXT,
        payload JSONB DEFAULT '{}', status TEXT DEFAULT 'received',
        error TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS webhook_registry (
        id BIGSERIAL PRIMARY KEY, name TEXT, url TEXT,
        events JSONB DEFAULT '[]', secret TEXT, enabled BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS channel_integrations (
        id BIGSERIAL PRIMARY KEY, channel TEXT UNIQUE NOT NULL,
        connected BOOLEAN DEFAULT FALSE, last_sync TIMESTAMPTZ,
        config JSONB DEFAULT '{}', error TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS social_posts (
        id BIGSERIAL PRIMARY KEY, channel TEXT, content TEXT, image_url TEXT,
        hashtags JSONB DEFAULT '[]', media_url TEXT, visibility TEXT DEFAULT 'public',
        status TEXT DEFAULT 'queued', post_id TEXT, post_url TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS monitors (
        id BIGSERIAL PRIMARY KEY, channel TEXT, subreddit TEXT,
        keywords JSONB DEFAULT '[]', auto_respond BOOLEAN DEFAULT FALSE,
        status TEXT DEFAULT 'active', created_at TIMESTAMPTZ DEFAULT NOW()
    );
    """

    alter_stmts = [
        "ALTER TABLE escalations ALTER COLUMN type DROP NOT NULL",
        "ALTER TABLE escalations ADD COLUMN IF NOT EXISTS source_id BIGINT",
        "ALTER TABLE escalations ADD COLUMN IF NOT EXISTS assigned_to TEXT",
        "ALTER TABLE escalations ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'",
        "ALTER TABLE escalations ADD COLUMN IF NOT EXISTS resolution TEXT",
        "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS customer_email TEXT",
        "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS customer_name TEXT",
        "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new'",
        "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS conversation_id BIGINT",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS channel TEXT",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS direction TEXT DEFAULT 'inbound'",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS recipient TEXT",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'received'",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'",
    ]

    async with pool.acquire() as conn:
        for stmt in schema_sql.split(";"):
            s = stmt.strip()
            if s:
                try:
                    await conn.execute(s)
                except Exception as e:
                    print(f"Schema warning: {e}")
        for stmt in alter_stmts:
            try:
                await conn.execute(stmt)
            except Exception:
                pass
        # Clear cached prepared statement plans after schema changes
        try:
            await conn.execute("DEALLOCATE ALL")
        except Exception:
            pass

    await _seed_defaults()


async def _seed_defaults():
    db = AsyncDB()
    try:
        existing = await db.table("config").select("key").execute()
        keys = {r["key"] for r in (existing.data or [])}
        defaults = {
            "brand_voice": "Professional, innovative, and approachable",
            "brand_name": "patienceai.in",
            "company_name": os.getenv("COMPANY_NAME", "patienceai.in"),
        }
        for k, v in defaults.items():
            if k not in keys:
                await db.table("config").insert({"key": k, "value": v}).execute()

        content_check = await db.table("content").select("id").limit(1).execute()
        if not content_check.data:
            samples = [
                {
                    "date": "2026-05-10", "platform": "twitter", "topic": "AI Marketing",
                    "hook": "AI is transforming how businesses connect with customers.",
                    "body": "From personalized content to predictive analytics, AI-powered marketing tools are helping brands create more meaningful connections at scale.",
                    "cta": "Ready to transform your marketing? Start exploring AI tools today.",
                    "posted": False,
                },
                {
                    "date": "2026-05-11", "platform": "linkedin", "topic": "Growth Automation",
                    "hook": "Stop spending hours on manual growth tasks.",
                    "body": "Modern automation tools can generate, schedule, and post content across all your channels. Focus on strategy while AI handles execution.",
                    "cta": "Automate your growth workflow now.",
                    "posted": False,
                },
            ]
            for s in samples:
                await db.table("content").insert(s).execute()
    except Exception as e:
        print(f"Seed warning: {e}")


def init_db():
    """Called at startup (sync context)."""
    try:
        _run(_async_init_db())
    except Exception as e:
        print(f"DB init warning: {e}")
