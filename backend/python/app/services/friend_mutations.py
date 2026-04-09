from sqlalchemy.orm import Session

from app.models.friendship import Friendship
from app.models.user import User

from .friend_core import _get_friendship_by_id, find_relationship_between_users


def send_friend_request(db: Session, requester_id: int, addressee_id: int):
    if requester_id == addressee_id:
        raise ValueError("Cannot send friend request to yourself")

    addressee = db.query(User).filter(User.id == addressee_id).first()
    if addressee is None:
        raise LookupError("User not found")

    existing = find_relationship_between_users(db, requester_id, addressee_id)
    if existing:
        if existing.status == "accepted":
            raise ValueError("Users are already friends")
        raise ValueError("Friend request already exists")

    friendship = Friendship(
        requester_id=requester_id,
        addressee_id=addressee_id,
        status="pending",
    )
    db.add(friendship)
    db.commit()
    db.refresh(friendship)
    return friendship


def accept_friend_request(db: Session, friendship_id: int, current_user_id: int):
    friendship = _get_friendship_by_id(db, friendship_id)
    if friendship.addressee_id != current_user_id:
        raise PermissionError("Only addressee can accept this friend request")
    if friendship.status != "pending":
        raise ValueError("Friend request is not pending")

    friendship.status = "accepted"
    db.commit()
    db.refresh(friendship)
    return friendship


def delete_friendship_record(db: Session, friendship, current_user_id: int):
    if current_user_id not in (friendship.requester_id, friendship.addressee_id):
        raise PermissionError("You are not part of this friendship")

    db.delete(friendship)
    db.commit()


def delete_friend(db: Session, friendship_id: int, current_user_id: int):
    friendship = _get_friendship_by_id(db, friendship_id)
    delete_friendship_record(db, friendship, current_user_id)
