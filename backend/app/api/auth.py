from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from app.database import get_db, DBUser
from app.services.auth_service import verify_google_token, create_access_token, verify_token
from app.models import GoogleAuthRequest, AuthResponse, User
from datetime import datetime
from jose import JWTError

router = APIRouter()


def get_current_user(authorization: str = Header(...), db: Session = Depends(get_db)) -> DBUser:
    """
    Dependency to get current authenticated user

    Extracts JWT from Authorization header, verifies it,
    and returns the user from database.

    Args:
        authorization: Authorization header with Bearer token
        db: Database session

    Returns:
        DBUser instance of authenticated user

    Raises:
        HTTPException: If token is invalid or user not found
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")

    token = authorization.split(" ")[1]
    try:
        user_id = verify_token(token)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = db.query(DBUser).filter(DBUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return user


@router.post("/google", response_model=AuthResponse)
async def google_auth(auth_request: GoogleAuthRequest, db: Session = Depends(get_db)):
    """
    Authenticate user with Google OAuth token

    Verifies the Google ID token, creates or updates user in database,
    and returns a JWT access token for subsequent requests.
    """
    try:
        user_info = verify_google_token(auth_request.token)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

    # Create or update user
    db_user = db.query(DBUser).filter(DBUser.id == user_info["id"]).first()
    if not db_user:
        db_user = DBUser(
            id=user_info["id"],
            email=user_info["email"],
            name=user_info["name"],
            picture=user_info.get("picture")
        )
        db.add(db_user)
    else:
        db_user.name = user_info["name"]
        db_user.picture = user_info.get("picture")
        db_user.updated_at = datetime.now()

    db.commit()
    db.refresh(db_user)

    # Generate JWT
    access_token = create_access_token(db_user.id)

    return AuthResponse(
        access_token=access_token,
        user=User(
            id=db_user.id,
            email=db_user.email,
            name=db_user.name,
            picture=db_user.picture
        )
    )


@router.get("/me", response_model=User)
async def get_current_user_info(current_user: DBUser = Depends(get_current_user)):
    """Get current authenticated user information"""
    return User(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        picture=current_user.picture
    )
