import bcrypt
from ..utils.database import query, query_one
from ..utils.crypto import generate_api_key, hash_api_key

def create_admin(name, email, password, role='admin'):
    """Create a new admin user"""
    api_key = generate_api_key('wh_admin')
    api_key_hash = hash_api_key(api_key)
    password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

    sql = """
        INSERT INTO admins (name, email, api_key, api_key_hash, password_hash, role)
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING id, name, email, role, status, created_at, updated_at
    """

    admin = query_one(sql, (name, email, api_key, api_key_hash, password_hash, role))
    return {'admin': dict(admin), 'apiKey': api_key}

def get_admin_by_id(admin_id):
    """Get admin by ID"""
    sql = "SELECT * FROM admins WHERE id = %s"
    result = query_one(sql, (admin_id,))
    return dict(result) if result else None

def get_admin_by_email(email):
    """Get admin by email"""
    sql = "SELECT * FROM admins WHERE email = %s"
    result = query_one(sql, (email,))
    return dict(result) if result else None

def get_admin_by_api_key(api_key):
    """Get admin by API key"""
    api_key_hash = hash_api_key(api_key)
    sql = "SELECT * FROM admins WHERE api_key_hash = %s AND status = 'active'"
    result = query_one(sql, (api_key_hash,))
    return dict(result) if result else None

def list_admins(filters=None, page=1, limit=20):
    """List admins with pagination"""
    offset = (page - 1) * limit
    conditions = []
    params = []

    if filters:
        if filters.get('status'):
            conditions.append("status = %s")
            params.append(filters['status'])
        if filters.get('role'):
            conditions.append("role = %s")
            params.append(filters['role'])
        if filters.get('search'):
            conditions.append("(name ILIKE %s OR email ILIKE %s)")
            params.extend([f"%{filters['search']}%", f"%{filters['search']}%"])

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    # Get total count
    count_sql = f"SELECT COUNT(*) as total FROM admins {where_clause}"
    total_result = query_one(count_sql, params)
    total = total_result['total'] if total_result else 0

    # Get paginated results
    admins_sql = f"""
        SELECT * FROM admins
        {where_clause}
        ORDER BY created_at DESC
        LIMIT %s OFFSET %s
    """
    params.extend([limit, offset])
    admins = query(admins_sql, params)

    return {
        'admins': [dict(admin) for admin in admins] if admins else [],
        'total': total
    }

def update_admin(admin_id, data):
    """Update admin"""
    updates = []
    params = []

    if 'name' in data:
        updates.append("name = %s")
        params.append(data['name'])
    if 'email' in data:
        updates.append("email = %s")
        params.append(data['email'])
    if 'role' in data:
        updates.append("role = %s")
        params.append(data['role'])
    if 'status' in data:
        updates.append("status = %s")
        params.append(data['status'])
    if 'password' in data:
        password_hash = bcrypt.hashpw(data['password'].encode(), bcrypt.gensalt()).decode()
        updates.append("password_hash = %s")
        params.append(password_hash)

    if not updates:
        return None

    updates.append("updated_at = CURRENT_TIMESTAMP")
    params.append(admin_id)

    sql = f"""
        UPDATE admins
        SET {', '.join(updates)}
        WHERE id = %s
        RETURNING *
    """

    result = query_one(sql, params)
    return dict(result) if result else None

def verify_admin_password(email, password):
    """Verify admin password"""
    admin = get_admin_by_email(email)

    if not admin or not admin.get('password_hash'):
        return None

    if not bcrypt.checkpw(password.encode(), admin['password_hash'].encode()):
        return None

    if admin.get('status') != 'active':
        return None

    return admin

def update_admin_last_login(admin_id):
    """Update last login time"""
    sql = "UPDATE admins SET last_login_at = CURRENT_TIMESTAMP WHERE id = %s"
    query(sql, (admin_id,))
