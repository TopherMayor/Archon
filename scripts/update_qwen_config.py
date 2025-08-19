#!/usr/bin/env python3
"""
Update Archon Qwen Configuration Script

This script updates Archon to use the correct Qwen credentials and API endpoint
from the existing ~/.qwen/oauth_creds.json file.
"""

import json
import os
import sys
from pathlib import Path

# Add the Python source directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "python", "src"))

from server.services.credential_service import credential_service

async def update_qwen_configuration():
    """Update Archon configuration with Qwen credentials and correct endpoint."""
    
    print("🔧 Updating Archon Qwen Configuration...")
    
    # Load credentials from ~/.qwen/oauth_creds.json
    qwen_creds_path = Path.home() / ".qwen" / "oauth_creds.json"
    
    if not qwen_creds_path.exists():
        print(f"❌ Error: Qwen credentials file not found at {qwen_creds_path}")
        return False
    
    try:
        with open(qwen_creds_path, 'r') as f:
            creds = json.load(f)
        
        print(f"✅ Loaded credentials from {qwen_creds_path}")
        
        # Extract credentials
        access_token = creds.get("access_token")
        refresh_token = creds.get("refresh_token")
        expiry_date = creds.get("expiry_date")
        resource_url = creds.get("resource_url", "portal.qwen.ai")
        
        if not access_token or not refresh_token:
            print("❌ Error: Missing required tokens in credentials file")
            return False
        
        print(f"📊 Token expires at: {expiry_date}")
        print(f"🌐 Resource URL: {resource_url}")
        
        # Initialize credential service
        await credential_service.load_all_credentials()
        
        # Update OAuth tokens
        print("🔐 Updating OAuth tokens...")
        await credential_service.set_credential(
            "QWEN_AUTH_TOKEN", 
            access_token, 
            is_encrypted=True, 
            category="api_keys",
            description="Cached Qwen OAuth access token (from ~/.qwen/oauth_creds.json)"
        )
        
        await credential_service.set_credential(
            "QWEN_REFRESH_TOKEN", 
            refresh_token, 
            is_encrypted=True, 
            category="api_keys",
            description="Qwen OAuth refresh token (from ~/.qwen/oauth_creds.json)"
        )
        
        # Update token expiry
        if expiry_date:
            await credential_service.set_credential(
                "QWEN_TOKEN_EXPIRY", 
                str(expiry_date), 
                category="rag_strategy",
                description="OAuth token expiration timestamp (from ~/.qwen/oauth_creds.json)"
            )
        
        # Update API endpoint to use portal.qwen.ai
        qwen_endpoint = f"https://{resource_url}/api/v1"
        print(f"🔗 Setting API endpoint to: {qwen_endpoint}")
        
        await credential_service.set_credential(
            "QWEN_API_ENDPOINT", 
            qwen_endpoint, 
            category="rag_strategy",
            description="Qwen API endpoint URL (portal.qwen.ai based)"
        )
        
        # Switch to Qwen as active provider
        print("🔄 Setting Qwen as active LLM provider...")
        await credential_service.set_credential(
            "LLM_PROVIDER", 
            "qwen", 
            category="rag_strategy",
            description="LLM provider to use: openai, openrouter, google, ollama, or qwen"
        )
        
        # Set qwen3-coder-plus as the active model
        await credential_service.set_credential(
            "MODEL_CHOICE", 
            "qwen3-coder-plus", 
            category="rag_strategy",
            description="Active model: qwen3-coder-plus (optimized for coding tasks)"
        )
        
        print("✅ Configuration updated successfully!")
        print("\n📋 Current Qwen Configuration:")
        print(f"   Provider: qwen")
        print(f"   Model: qwen3-coder-plus")
        print(f"   Endpoint: {qwen_endpoint}")
        print(f"   Token Status: Active (expires {expiry_date})")
        
        print("\n🚀 Next Steps:")
        print("   1. Restart Archon services: docker compose restart")
        print("   2. Test the connection in Archon UI")
        print("   3. Monitor logs for any authentication issues")
        
        return True
        
    except Exception as e:
        print(f"❌ Error updating configuration: {e}")
        return False

if __name__ == "__main__":
    import asyncio
    asyncio.run(update_qwen_configuration())
