from ..shared.models.admin import create_admin, list_admins, get_admin_by_id, update_admin
from ..shared.utils.response import success_response, bad_request, not_found

def handle_create_admin(data):
    """Handle create admin"""
    if not data.get('name'):
        return bad_request('name is required')
    if not data.get('email'):
        return bad_request('email is required')
    if not data.get('password'):
        return bad_request('password is required')

    try:
        result = create_admin(
            data['name'],
            data['email'],
            data['password'],
            data.get('role', 'admin')
        )
        return success_response({
            'admin': result['admin'],
            'apiKey': result['apiKey'],
            'message': 'Admin user created successfully'
        }, 201)
    except Exception as e:
        print(f'Failed to create admin: {e}')
        return bad_request(str(e))

def handle_list_admins(params):
    """Handle list admins"""
    try:
        page = int(params.get('page', 1))
        limit = int(params.get('limit', 20))
        filters = {
            'status': params.get('status'),
            'role': params.get('role'),
            'search': params.get('search'),
        }
        filters = {k: v for k, v in filters.items() if v}

        result = list_admins(filters, page, limit)
        return success_response(result)
    except Exception as e:
        print(f'Failed to list admins: {e}')
        return bad_request(str(e))

def handle_get_admin(admin_id):
    """Handle get admin"""
    try:
        admin = get_admin_by_id(admin_id)
        if not admin:
            return not_found('Admin not found')
        return success_response(admin)
    except Exception as e:
        print(f'Failed to get admin: {e}')
        return bad_request(str(e))

def handle_update_admin(admin_id, data):
    """Handle update admin"""
    try:
        admin = update_admin(admin_id, data)
        if not admin:
            return not_found('Admin not found')
        return success_response({
            'admin': admin,
            'message': 'Admin updated successfully'
        })
    except Exception as e:
        print(f'Failed to update admin: {e}')
        return bad_request(str(e))

def handle_delete_admin(admin_id):
    """Handle delete admin (soft delete)"""
    try:
        admin = update_admin(admin_id, {'status': 'inactive'})
        if not admin:
            return not_found('Admin not found')
        return success_response({'message': 'Admin deleted successfully'})
    except Exception as e:
        print(f'Failed to delete admin: {e}')
        return bad_request(str(e))
