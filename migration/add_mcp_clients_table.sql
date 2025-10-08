-- Migration: create table to persist MCP clients (connected and historical)
-- Purpose: enable UI to list MCP clients as assignees (connected first, then previously seen)

-- Ensure pgcrypto is available for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Core registry table
CREATE TABLE IF NOT EXISTS mcp_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT,
  display_name TEXT NOT NULL UNIQUE,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('connected','disconnected')),
  last_seen_version TEXT,
  capabilities JSONB
);

-- Indexes to accelerate common queries (connected first, recency)
CREATE INDEX IF NOT EXISTS idx_mcp_clients_status_last_seen ON mcp_clients (status, last_seen DESC);

COMMENT ON TABLE mcp_clients IS 'Registry of MCP clients, connected and historical, used to power assignee selection.';
COMMENT ON COLUMN mcp_clients.display_name IS 'Human-friendly unique client name (e.g., copilot-air, warp-air).';
COMMENT ON COLUMN mcp_clients.status IS 'connected | disconnected';
