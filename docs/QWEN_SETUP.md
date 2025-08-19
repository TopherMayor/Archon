# Qwen Provider Setup Guide

This guide walks you through setting up Qwen as an LLM provider in Archon, with **qwen3-coder-plus** as the recommended model for coding and development tasks.

## 🚀 Quick Start

### 1. Apply Database Migration

Run the Qwen support migration in your Supabase SQL Editor:

```sql
-- File: migration/add_qwen_support.sql
-- Copy and paste the contents of this file into your Supabase SQL Editor
```

### 2. (Optional) Quick Provider Setup

If you want to immediately switch to Qwen as your active provider:

```sql
-- File: migration/setup_qwen_defaults.sql
-- This sets Qwen as active provider with qwen3-coder-plus as the default model
```

### 3. Restart Archon Services

```bash
cd /Volumes/2TB/AI/Archon
docker compose restart
```

## 🔐 Authentication Setup

Qwen uses OAuth authentication instead of API keys. You'll need to configure your OAuth credentials.

### Method 1: Via Settings UI (Recommended)

1. Open Archon at http://localhost:3737
2. Go to **Settings** → **RAG Settings**
3. Select **"Qwen"** as your LLM Provider
4. Configure the Qwen API Endpoint (default: `https://portal.qwen.ai/api/v1`)
5. Set your model to **`qwen3-coder-plus`**

### Method 2: Via Database (Advanced)

If you need to set OAuth credentials directly in the database:

```sql
-- Set encrypted OAuth credentials
INSERT INTO archon_settings (key, encrypted_value, is_encrypted, category, description) VALUES
('QWEN_USERNAME', 'your_encrypted_username', true, 'api_keys', 'Qwen OAuth username for authentication'),
('QWEN_PASSWORD', 'your_encrypted_password', true, 'api_keys', 'Qwen OAuth password for authentication')
ON CONFLICT (key) DO UPDATE SET
    encrypted_value = EXCLUDED.encrypted_value;
```

## ⚙️ Configuration Options

### Recommended Model Configuration

| Setting | Recommended Value | Description |
|---------|------------------|-------------|
| **LLM Provider** | `qwen` | Select Qwen as your provider |
| **Chat Model** | `qwen3-coder-plus` | Optimized for coding tasks |
| **Embedding Model** | `text-embedding-v1` | Qwen's default embedding model |
| **API Endpoint** | `https://portal.qwen.ai/api/v1` | Default Qwen API endpoint |

### Alternative Models

While **qwen3-coder-plus** is recommended for coding, you can also use:

- `qwen2.5-72b-instruct` - General purpose large model
- `qwq-32b-preview` - Preview model for specific tasks
- `qwen-turbo` - Faster, lighter model

## 🔧 Advanced Configuration

### Custom API Endpoint

If you're using a self-hosted Qwen instance or different endpoint:

```sql
UPDATE archon_settings 
SET value = 'https://your-custom-qwen-endpoint.com/api/v1'
WHERE key = 'QWEN_API_ENDPOINT';
```

### Token Management

Qwen tokens are automatically managed with:

- **Automatic refresh** 5 minutes before expiration
- **Persistent storage** in encrypted database
- **Error handling** with graceful fallbacks

## 🛠️ Troubleshooting

### Common Issues

#### 1. "Qwen authentication failed"

**Solution**: Check your OAuth credentials
```sql
-- Verify credentials exist
SELECT key, is_encrypted, category 
FROM archon_settings 
WHERE key LIKE 'QWEN_%' AND category = 'api_keys';
```

#### 2. "Token expired" errors

**Solution**: The system should auto-refresh, but you can manually clear tokens:
```sql
-- Clear cached tokens to force refresh
UPDATE archon_settings 
SET encrypted_value = NULL 
WHERE key IN ('QWEN_AUTH_TOKEN', 'QWEN_REFRESH_TOKEN');
```

#### 3. Model not found

**Solution**: Verify your model name matches Qwen's available models:
```sql
-- Check current model setting
SELECT value FROM archon_settings WHERE key = 'MODEL_CHOICE';

-- Update to qwen3-coder-plus
UPDATE archon_settings SET value = 'qwen3-coder-plus' WHERE key = 'MODEL_CHOICE';
```

### Debug Mode

Enable detailed logging by setting:
```sql
UPDATE archon_settings SET value = 'DEBUG' WHERE key = 'LOG_LEVEL';
```

Then restart services and check logs:
```bash
docker compose logs -f archon-server
```

## 📊 Verification

### Check Configuration

```sql
-- View current Qwen configuration
SELECT 
    key, 
    value, 
    CASE WHEN is_encrypted THEN '[ENCRYPTED]' ELSE value END as display_value,
    category,
    description
FROM archon_settings 
WHERE key LIKE 'QWEN_%' OR key IN ('LLM_PROVIDER', 'MODEL_CHOICE', 'EMBEDDING_MODEL')
ORDER BY category, key;
```

### Test Connection

1. Open Archon UI
2. Go to **Knowledge Base** or **Chat**
3. Try a simple query to verify Qwen is responding
4. Check the logs for any authentication or API errors

## 🎯 Best Practices

### Model Selection

- **For coding tasks**: Use `qwen3-coder-plus` (recommended)
- **For general chat**: Use `qwen2.5-72b-instruct`
- **For quick responses**: Use `qwen-turbo`

### Performance Optimization

1. **Enable caching**: Tokens are cached for 5 minutes by default
2. **Monitor usage**: Check logs for authentication frequency
3. **Adjust batch sizes**: Tune RAG settings for your API limits

### Security

1. **Never store plain text credentials** - always use encrypted storage
2. **Rotate tokens regularly** - let the system auto-refresh
3. **Monitor access logs** - check for unauthorized usage

## 📚 Additional Resources

- [Qwen API Documentation](https://help.aliyun.com/zh/dashscope/)
- [Archon Settings Guide](./SETTINGS.md)
- [OAuth Authentication Best Practices](./OAUTH.md)

## 🆘 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Enable debug logging
3. Review Docker container logs
4. Verify database configuration

For development-specific questions about `qwen3-coder-plus`, refer to the model's documentation for optimal prompt engineering techniques.
