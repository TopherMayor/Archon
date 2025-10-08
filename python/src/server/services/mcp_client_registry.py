"""
MCP Client Registry

Purpose:
  Persistence layer for MCP clients so UI can list connected and historical clients as task assignees.

Contract:
  - mark_connected(display_name, client_id=None, version=None, capabilities=None)
  - mark_disconnected(display_name)
  - list_all() -> list of dicts (connected first, then historical)
  - exists(display_name) -> bool

Storage:
  Table `mcp_clients` (see migration/add_mcp_clients_table.sql)

Integration points:
  - services/mcp_session_manager.py: call mark_connected/mark_disconnected on lifecycle
  - api_routes/mcp_api.py: provide GET /api/mcp/clients/assignees
  - services/projects/task_service.py: validate agent_name against exists()

NOTE: Wire this to your existing DB utility (async or sync). The SQL is included below.
"""
from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone

from ..utils import get_supabase_client


@dataclass
class MCPClient:
    display_name: str
    status: str  # 'connected' | 'disconnected'
    client_id: Optional[str] = None
    last_seen: Optional[datetime] = None
    first_seen: Optional[datetime] = None
    last_seen_version: Optional[str] = None
    capabilities: Optional[Dict[str, Any]] = None


class MCPClientRegistry:
    # --- Helpers -----------------------------------------------------------------
    @staticmethod
    def _now_iso() -> str:
        return datetime.now(timezone.utc).isoformat()

    @staticmethod
    def _to_model(row: dict) -> MCPClient:
        return MCPClient(
            display_name=row.get("display_name"),
            status=row.get("status"),
            client_id=row.get("client_id"),
            last_seen=row.get("last_seen"),
            first_seen=row.get("first_seen"),
            last_seen_version=row.get("last_seen_version"),
            capabilities=row.get("capabilities"),
        )


    """Scaffold for a registry backed by the `mcp_clients` table.

    Replace the `pass`/TODO sections with your DB integration (psycopg/sqlalchemy/etc.).
    """

    # --- SQL templates (adjust if you use an ORM) ---
    SQL_UPSERT_CONNECTED = (
        """
        INSERT INTO mcp_clients (display_name, client_id, status, last_seen, first_seen, last_seen_version, capabilities)
        VALUES ($1, $2, 'connected', NOW(), NOW(), $3, $4)
        ON CONFLICT (display_name)
        DO UPDATE SET
            client_id = COALESCE(EXCLUDED.client_id, mcp_clients.client_id),
            status = 'connected',
            last_seen = NOW(),
            last_seen_version = EXCLUDED.last_seen_version,
            capabilities = EXCLUDED.capabilities
        RETURNING display_name, status, client_id, last_seen, first_seen, last_seen_version, capabilities;
        """
    )

    SQL_MARK_DISCONNECTED = (
        """
        UPDATE mcp_clients
        SET status = 'disconnected', last_seen = NOW()
        WHERE display_name = $1
        RETURNING display_name, status, client_id, last_seen, first_seen, last_seen_version, capabilities;
        """
    )

    SQL_LIST_ALL = (
        """
        SELECT display_name, status, client_id, last_seen, first_seen, last_seen_version, capabilities
        FROM mcp_clients
        ORDER BY (status = 'connected') DESC, last_seen DESC, display_name ASC;
        """
    )

    SQL_EXISTS = "SELECT 1 FROM mcp_clients WHERE display_name = $1 LIMIT 1;"

    def __init__(self, db=None):
        """Initialize with optional DB adapter.

        If no adapter is provided, use Supabase via get_supabase_client().
        """
        # For Supabase-backed implementation, we do not need `db`.
        # Keep attribute for compatibility if callers pass something in.
        self.db = db
        self.supabase = get_supabase_client()

    async def mark_connected(self, display_name: str, *, client_id: Optional[str] = None,
                             version: Optional[str] = None, capabilities: Optional[Dict[str, Any]] = None) -> MCPClient:
        """Upsert a client to status=connected and update last_seen/version/capabilities."""
        # TODO: replace with your DB call; example for asyncpg:
        # async with self.db.acquire() as conn:
        #     row = await conn.fetchrow(self.SQL_UPSERT_CONNECTED, display_name, client_id, version, jsonb(capabilities))
        # return MCPClient(**dict(row))
        try:
            existing = (
                self.supabase.table("mcp_clients").select("*").eq("display_name", display_name).limit(1).execute()
            )
            now = self._now_iso()
            if existing.data:
                row = existing.data[0]
                update = {"status": "connected", "last_seen": now}
                if client_id is not None:
                    update["client_id"] = client_id
                if version is not None:
                    update["last_seen_version"] = version
                if capabilities is not None:
                    update["capabilities"] = capabilities
                updated = self.supabase.table("mcp_clients").update(update).eq("display_name", display_name).execute()
                row = updated.data[0] if updated.data else {**row, **update}
                return self._to_model(row)
            else:
                insert = {
                    "display_name": display_name,
                    "client_id": client_id,
                    "status": "connected",
                    "first_seen": now,
                    "last_seen": now,
                    "last_seen_version": version,
                    "capabilities": capabilities or {},
                }
                res = self.supabase.table("mcp_clients").insert(insert).execute()
                row = res.data[0] if res.data else insert
                return self._to_model(row)
        except Exception:
            return MCPClient(display_name=display_name, status="connected", client_id=client_id, last_seen=self._now_iso(), first_seen=self._now_iso(), last_seen_version=version, capabilities=capabilities or {})

    async def mark_disconnected(self, display_name: str) -> Optional[MCPClient]:
        """Set status=disconnected; no-op if record not found (return None)."""
        # TODO: DB call to execute SQL_MARK_DISCONNECTED
        try:
            now = self._now_iso()
            updated = self.supabase.table("mcp_clients").update({"status": "disconnected", "last_seen": now}).eq("display_name", display_name).execute()
            if updated.data:
                return self._to_model(updated.data[0])
            insert = {"display_name": display_name, "status": "disconnected", "first_seen": now, "last_seen": now}
            res = self.supabase.table("mcp_clients").insert(insert).execute()
            row = res.data[0] if res.data else insert
            return self._to_model(row)
        except Exception:
            return None

    async def list_all(self) -> List[MCPClient]:
        """Return connected clients first, then historical (ordered by last_seen)."""
        # TODO: DB call to execute SQL_LIST_ALL and map rows to MCPClient
        try:
            resp = self.supabase.table("mcp_clients").select("*").order("last_seen", desc=True).execute()
            rows = resp.data or []
            rows.sort(key=lambda r: (r.get("status") != "connected", r.get("display_name", "")))
            return [self._to_model(r) for r in rows]
        except Exception:
            return []

    async def exists(self, display_name: str) -> bool:
        """Return True if a client with the given display_name exists."""
        # TODO: DB call to execute SQL_EXISTS
        try:
            resp = self.supabase.table("mcp_clients").select("display_name").eq("display_name", display_name).limit(1).execute()
            return bool(resp.data)
        except Exception:
            return False
