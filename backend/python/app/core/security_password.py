from argon2 import PasswordHasher
from argon2.exceptions import InvalidHash, VerificationError, VerifyMismatchError

password_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    if not isinstance(password, str):
        password = str(password)
    return password_hasher.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not isinstance(plain_password, str):
        plain_password = str(plain_password)
    try:
        return password_hasher.verify(hashed_password, plain_password)
    except (VerifyMismatchError, VerificationError, InvalidHash):
        return False
