-- =====================================================
-- Qwen Provider Quick Setup Script
-- =====================================================
-- This script sets up Qwen as the active provider with
-- qwen3-coder-plus as the default model
-- 
-- Run this after applying the main Qwen migration if you
-- want to quickly switch to Qwen as your active provider
-- =====================================================

-- Set Qwen as the active LLM provider
UPDATE archon_settings 
SET value = 'qwen'
WHERE key = 'LLM_PROVIDER';

-- Set qwen3-coder-plus as the default model choice
UPDATE archon_settings 
SET value = 'qwen3-coder-plus'
WHERE key = 'MODEL_CHOICE';

-- Set the Qwen API endpoint (if not already set)
INSERT INTO archon_settings (key, value, is_encrypted, category, description) VALUES
('QWEN_API_ENDPOINT', 'https://portal.qwen.ai/api/v1', false, 'rag_strategy', 'Qwen API endpoint URL for LLM requests')
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    description = EXCLUDED.description;

-- Set Qwen's default embedding model
UPDATE archon_settings 
SET value = 'text-embedding-v1'
WHERE key = 'EMBEDDING_MODEL';

-- Display current configuration
SELECT 
    key, 
    value, 
    category,
    description
FROM archon_settings 
WHERE key IN ('LLM_PROVIDER', 'MODEL_CHOICE', 'EMBEDDING_MODEL', 'QWEN_API_ENDPOINT')
ORDER BY 
    CASE key 
        WHEN 'LLM_PROVIDER' THEN 1
        WHEN 'MODEL_CHOICE' THEN 2
        WHEN 'EMBEDDING_MODEL' THEN 3
        WHEN 'QWEN_API_ENDPOINT' THEN 4
        ELSE 5
    END;
