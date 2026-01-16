from google.oauth2 import id_token
from google.auth.transport import requests
from jose import jwt, JWTError
from datetime import datetime, timedelta
import os

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days


def verify_google_token(token: str) -> dict:
    """
    Verify Google ID token and return user info

    Args:
        token: Google ID token from frontend

    Returns:
        dict with user info (id, email, name, picture)

    Raises:
        ValueError: If token is invalid
    """
    try:
        idinfo = id_token.verify_oauth2_token(
            token, requests.Request(), GOOGLE_CLIENT_ID
        )

        return {
            "id": idinfo["sub"],
            "email": idinfo["email"],
            "name": idinfo["name"],
            "picture": idinfo.get("picture")
        }
    except Exception as e:
        raise ValueError(f"Invalid Google token: {str(e)}")


def create_access_token(user_id: str) -> str:
    """
    Create JWT access token

    Args:
        user_id: User ID to encode in token

    Returns:
        JWT token string
    """
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"sub": user_id, "exp": expire}
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> str:
    """
    Verify JWT and return user_id

    Args:
        token: JWT token to verify

    Returns:
        user_id extracted from token

    Raises:
        JWTError: If token is invalid or expired
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise JWTError("Invalid token payload")
        return user_id
    except JWTError as e:
        raise JWTError(f"Token verification failed: {str(e)}")
