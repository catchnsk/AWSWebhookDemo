import hashlib
import secrets

def generate_api_key(prefix='wh'):
    """Generate a random API key"""
    random_key = secrets.token_hex(32)
    return f"{prefix}_{random_key}"

def hash_api_key(api_key):
    """Hash an API key using SHA256"""
    return hashlib.sha256(api_key.encode()).hexdigest()
