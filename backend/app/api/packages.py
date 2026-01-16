from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db, DBPackage, DBUser, DBTrackingEvent
from app.models import Package, PackageCreate, PackageUpdate, TrackingEvent
from app.api.auth import get_current_user
import uuid

router = APIRouter()


@router.get("", response_model=List[Package])
async def get_packages(
    archived: bool = False,
    current_user: DBUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all packages for the current user"""
    packages = db.query(DBPackage).filter(
        DBPackage.user_id == current_user.id,
        DBPackage.archived == archived
    ).all()
    return packages


@router.post("", response_model=Package, status_code=201)
async def create_package(
    package: PackageCreate,
    current_user: DBUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new package for the current user"""
    db_package = DBPackage(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        tracking_number=package.tracking_number,
        courier=package.courier,
        nickname=package.nickname,
        description=package.description
    )
    db.add(db_package)
    db.commit()
    db.refresh(db_package)
    return db_package


@router.get("/{package_id}", response_model=Package)
async def get_package(
    package_id: str,
    current_user: DBUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific package by ID"""
    package = db.query(DBPackage).filter(
        DBPackage.id == package_id,
        DBPackage.user_id == current_user.id
    ).first()

    if not package:
        raise HTTPException(status_code=404, detail="Package not found")

    return package


@router.put("/{package_id}", response_model=Package)
async def update_package(
    package_id: str,
    package_update: PackageUpdate,
    current_user: DBUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a package's information"""
    db_package = db.query(DBPackage).filter(
        DBPackage.id == package_id,
        DBPackage.user_id == current_user.id
    ).first()

    if not db_package:
        raise HTTPException(status_code=404, detail="Package not found")

    # Update only provided fields
    if package_update.courier is not None:
        db_package.courier = package_update.courier
    if package_update.nickname is not None:
        db_package.nickname = package_update.nickname
    if package_update.description is not None:
        db_package.description = package_update.description
    if package_update.archived is not None:
        db_package.archived = package_update.archived

    db.commit()
    db.refresh(db_package)
    return db_package


@router.delete("/{package_id}", status_code=204)
async def delete_package(
    package_id: str,
    current_user: DBUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a package"""
    db_package = db.query(DBPackage).filter(
        DBPackage.id == package_id,
        DBPackage.user_id == current_user.id
    ).first()

    if not db_package:
        raise HTTPException(status_code=404, detail="Package not found")

    db.delete(db_package)
    db.commit()
    return None


@router.get("/{package_id}/events", response_model=List[TrackingEvent])
async def get_package_events(
    package_id: str,
    current_user: DBUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all tracking events for a package"""
    # Verify package ownership
    package = db.query(DBPackage).filter(
        DBPackage.id == package_id,
        DBPackage.user_id == current_user.id
    ).first()

    if not package:
        raise HTTPException(status_code=404, detail="Package not found")

    # Get events sorted by timestamp (newest first)
    events = db.query(DBTrackingEvent).filter(
        DBTrackingEvent.package_id == package_id
    ).order_by(DBTrackingEvent.timestamp.desc()).all()

    return events
