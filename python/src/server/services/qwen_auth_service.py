"""
Qwen Authentication Service

Handles OAuth authentication for Qwen API endpoints, including token management,
refresh logic, and session handling.
"""

import json
import time
from datetime import datetime, timedelta
from typing import Any, Dict, Optional, Tuple

import httpx
from ..config.logfire_config import get_logger
from .credential_service import credential_service

logger = get_logger(__name__)


class QwenAuthService:
    """Service for managing Qwen OAuth authentication."""

    def __init__(self):
        self._auth_cache: Dict[str, Any] = {}
        self._cache_expiry: Optional[datetime] = None
        
    async def get_auth_headers(self, base_url: str = None) -> Dict[str, str]:
        """
        Get authentication headers for Qwen API requests.
        
        Args:
            base_url: Optional base URL for the Qwen API
            
        Returns:
            Dictionary of headers to include in API requests
            
        Raises:
            ValueError: If authentication fails or credentials are missing
        """
        try:
            # Check if we have a valid cached token
            if self._is_token_valid():
                logger.debug("Using cached Qwen auth token")
                return self._get_headers_from_cache()
            
            # Try to load existing tokens from database first
            await self._load_existing_tokens()
            if self._is_token_valid():
                logger.info("Loaded existing Qwen auth token from database")
                return self._get_headers_from_cache()
            
            # If no valid existing tokens, try to refresh
            logger.info("No valid tokens found, attempting to refresh")
            await self._refresh_auth_token(base_url)
            
            return self._get_headers_from_cache()
            
        except Exception as e:
            logger.error(f"Failed to get Qwen auth headers: {e}")
            raise ValueError(f"Qwen authentication failed: {e}")

    async def _refresh_auth_token(self, base_url: str = None) -> None:
        """
        Refresh the OAuth token using stored credentials.
        
        Args:
            base_url: Optional base URL for the Qwen API
        """
        try:
            # Get stored credentials
            username = await credential_service.get_credential("QWEN_USERNAME")
            password = await credential_service.get_credential("QWEN_PASSWORD")
            api_endpoint = await credential_service.get_credential(
                "QWEN_API_ENDPOINT", 
                default=base_url or "https://portal.qwen.ai"
            )
            
            if not username or not password:
                raise ValueError("Qwen username and password are required")
                
            # Attempt OAuth token acquisition
            auth_data = await self._perform_oauth_login(username, password, api_endpoint)
            
            # Cache the authentication data
            self._auth_cache = auth_data
            self._cache_expiry = datetime.now() + timedelta(
                seconds=auth_data.get("expires_in", 3600) - 300  # Refresh 5 minutes early
            )
            
            # Store tokens in database for persistence
            await self._store_auth_tokens(auth_data)
            
            logger.info("Qwen auth token refreshed successfully")
            
        except Exception as e:
            logger.error(f"Failed to refresh Qwen auth token: {e}")
            raise

    async def _perform_oauth_login(
        self, username: str, password: str, api_endpoint: str
    ) -> Dict[str, Any]:
        """
        Perform OAuth login to get access token.
        
        Args:
            username: Qwen username
            password: Qwen password  
            api_endpoint: API endpoint base URL
            
        Returns:
            Dictionary containing auth tokens and metadata
        """
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                # Typical OAuth2 password grant flow
                auth_url = f"{api_endpoint.rstrip('/')}/oauth/token"
                
                payload = {
                    "grant_type": "password",
                    "username": username,
                    "password": password,
                    "client_id": "qwen_api_client",  # May need to be configurable
                }
                
                headers = {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Accept": "application/json",
                }
                
                logger.debug(f"Performing OAuth login to {auth_url}")
                
                response = await client.post(auth_url, data=payload, headers=headers)
                response.raise_for_status()
                
                auth_data = response.json()
                
                # Validate response contains required fields
                if "access_token" not in auth_data:
                    raise ValueError("OAuth response missing access_token")
                    
                logger.info("OAuth login successful")
                return auth_data
                
        except httpx.HTTPStatusError as e:
            logger.error(f"OAuth login HTTP error: {e.response.status_code} - {e.response.text}")
            raise ValueError(f"OAuth login failed: HTTP {e.response.status_code}")
        except Exception as e:
            logger.error(f"OAuth login error: {e}")
            raise

    async def _store_auth_tokens(self, auth_data: Dict[str, Any]) -> None:
        """Store auth tokens in the database."""
        try:
            # Store access token
            if "access_token" in auth_data:
                await credential_service.set_credential(
                    "QWEN_AUTH_TOKEN",
                    auth_data["access_token"],
                    is_encrypted=True,
                    category="api_keys"
                )
            
            # Store refresh token if provided
            if "refresh_token" in auth_data:
                await credential_service.set_credential(
                    "QWEN_REFRESH_TOKEN", 
                    auth_data["refresh_token"],
                    is_encrypted=True,
                    category="api_keys"
                )
            
            # Store expiry timestamp
            if "expires_in" in auth_data:
                expiry_timestamp = int(time.time()) + auth_data["expires_in"]
                await credential_service.set_credential(
                    "QWEN_TOKEN_EXPIRY",
                    str(expiry_timestamp),
                    category="rag_strategy"
                )
                
            logger.debug("Auth tokens stored successfully")
            
        except Exception as e:
            logger.error(f"Failed to store auth tokens: {e}")
            # Non-fatal, we can still use the in-memory cache

    def _is_token_valid(self) -> bool:
        """Check if the cached token is still valid."""
        if not self._auth_cache or not self._cache_expiry:
            return False
            
        return datetime.now() < self._cache_expiry and "access_token" in self._auth_cache

    async def _load_existing_tokens(self) -> None:
        """Load existing tokens from the database into cache."""
        try:
            # Get stored tokens from database
            access_token = await credential_service.get_credential("QWEN_AUTH_TOKEN")
            refresh_token = await credential_service.get_credential("QWEN_REFRESH_TOKEN")
            token_expiry = await credential_service.get_credential("QWEN_TOKEN_EXPIRY")
            
            if access_token and token_expiry:
                # Convert expiry timestamp to datetime
                try:
                    expiry_timestamp = int(token_expiry) / 1000  # Convert from milliseconds
                    expiry_datetime = datetime.fromtimestamp(expiry_timestamp)
                    
                    # Only cache if token hasn't expired (with 5 minute buffer)
                    if expiry_datetime > datetime.now() + timedelta(minutes=5):
                        self._auth_cache = {
                            "access_token": access_token,
                            "refresh_token": refresh_token,
                            "token_type": "Bearer"
                        }
                        self._cache_expiry = expiry_datetime - timedelta(minutes=5)
                        logger.info("Loaded valid tokens from database")
                    else:
                        logger.info("Stored tokens have expired")
                        
                except (ValueError, TypeError) as e:
                    logger.error(f"Error parsing token expiry timestamp: {e}")
            else:
                logger.debug("No stored tokens found in database")
                
        except Exception as e:
            logger.error(f"Failed to load existing tokens: {e}")

    def _get_headers_from_cache(self) -> Dict[str, str]:
        """Get authentication headers from cached token."""
        if not self._auth_cache or "access_token" not in self._auth_cache:
            raise ValueError("No valid auth token in cache")
            
        access_token = self._auth_cache["access_token"]
        
        # Common headers for Qwen API
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        
        # Add any additional headers if needed
        if "token_type" in self._auth_cache:
            token_type = self._auth_cache["token_type"]
            if token_type.lower() != "bearer":
                headers["Authorization"] = f"{token_type} {access_token}"
        
        return headers

    async def validate_credentials(self, username: str, password: str, api_endpoint: str) -> bool:
        """
        Validate Qwen credentials by attempting authentication.
        
        Args:
            username: Qwen username
            password: Qwen password
            api_endpoint: API endpoint base URL
            
        Returns:
            True if credentials are valid, False otherwise
        """
        try:
            await self._perform_oauth_login(username, password, api_endpoint)
            return True
        except Exception as e:
            logger.warning(f"Credential validation failed: {e}")
            return False

    async def revoke_tokens(self) -> None:
        """Revoke stored tokens and clear cache."""
        try:
            # Clear in-memory cache
            self._auth_cache.clear()
            self._cache_expiry = None
            
            # Clear stored tokens
            await credential_service.set_credential("QWEN_AUTH_TOKEN", "", category="api_keys")
            await credential_service.set_credential("QWEN_REFRESH_TOKEN", "", category="api_keys")
            await credential_service.set_credential("QWEN_TOKEN_EXPIRY", "", category="rag_strategy")
            
            logger.info("Qwen auth tokens revoked")
            
        except Exception as e:
            logger.error(f"Failed to revoke tokens: {e}")


# Global instance
qwen_auth_service = QwenAuthService()
