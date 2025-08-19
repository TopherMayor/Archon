-- =====================================================
-- Qwen Provider Support Migration
-- =====================================================
-- This migration adds support for Qwen as an LLM provider
-- using OAuth authentication instead of API keys
-- 
-- Run this script in your Supabase SQL Editor to add
-- Qwen provider configuration options
-- =====================================================

-- Add Qwen OAuth credentials (encrypted for security)
INSERT INTO archon_settings (key, encrypted_value, is_encrypted, category, description) VALUES
('QWEN_USERNAME', NULL, true, 'api_keys', 'Qwen OAuth username for authentication'),
('QWEN_PASSWORD', NULL, true, 'api_keys', 'Qwen OAuth password for authentication'),
('QWEN_AUTH_TOKEN', NULL, true, 'api_keys', 'Cached Qwen OAuth access token (automatically managed)'),
('QWEN_REFRESH_TOKEN', NULL, true, 'api_keys', 'Qwen OAuth refresh token for automatic token renewal (automatically managed)')
ON CONFLICT (key) DO NOTHING;

-- Add Qwen configuration settings (plain text)
INSERT INTO archon_settings (key, value, is_encrypted, category, description) VALUES
('QWEN_API_ENDPOINT', 'https://portal.qwen.ai/api/v1', false, 'rag_strategy', 'Qwen API endpoint URL for LLM requests'),
('QWEN_TOKEN_EXPIRY', NULL, false, 'rag_strategy', 'OAuth token expiration timestamp (automatically managed)'),
('QWEN_DEFAULT_MODEL', 'qwen3-coder-plus', false, 'rag_strategy', 'Default Qwen model for coding and development tasks')
ON CONFLICT (key) DO NOTHING;

-- Update LLM_PROVIDER description to include Qwen as an option
UPDATE archon_settings 
SET description = 'LLM provider to use: openai, openrouter, google, ollama, or qwen'
WHERE key = 'LLM_PROVIDER' 
AND description = 'LLM provider to use: openai, openrouter, google, or ollama';

-- Add a comment to document when this migration was applied
COMMENT ON TABLE archon_settings IS 'Stores application configuration including API keys (OpenAI, Google, OpenRouter, Qwen OAuth), RAG settings, and code extraction parameters';

-- Verify the migration by selecting all Qwen-related settings
SELECT key, value, is_encrypted, category, description 
FROM archon_settings 
WHERE key LIKE 'QWEN_%' 
ORDER BY key;
