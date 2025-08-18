-- =====================================================
-- Add OpenRouter Support Migration
-- =====================================================
-- This migration adds OpenRouter as a supported LLM provider
-- with its own API key and configuration settings
-- =====================================================

-- Add OpenRouter API key placeholder
INSERT INTO archon_settings (key, encrypted_value, is_encrypted, category, description) VALUES
('OPENROUTER_API_KEY', NULL, true, 'api_keys', 'OpenRouter API Key for accessing OpenRouter models. Get from: https://openrouter.ai/keys')
ON CONFLICT (key) DO NOTHING;

-- Update LLM_PROVIDER description to include OpenRouter
UPDATE archon_settings 
SET description = 'LLM provider to use: openai, openrouter, google, or ollama'
WHERE key = 'LLM_PROVIDER';

-- Add comment documenting the OpenRouter integration
COMMENT ON TABLE archon_settings IS 'Stores application configuration including API keys (OpenAI, OpenRouter, Google), RAG settings, and code extraction parameters';
