#!/usr/bin/env python3
"""
Run all database migrations in order
Usage: python run_migrations.py <database_url>
Example: python run_migrations.py "postgres://user:pass@host:5432/dbname"
"""

import sys
import psycopg2
import os

def run_migration(cursor, filepath):
    """Run a single migration file"""
    print(f"\n📄 Running {os.path.basename(filepath)}...")
    try:
        with open(filepath, 'r') as f:
            sql = f.read()
            cursor.execute(sql)
        print(f"✅ {os.path.basename(filepath)} completed successfully")
        return True
    except Exception as e:
        print(f"❌ Error in {os.path.basename(filepath)}: {e}")
        return False

def main():
    if len(sys.argv) < 2:
        print("Usage: python run_migrations.py <database_url>")
        print('Example: python run_migrations.py "postgres://user:pass@host.render.com:5432/webhook_db"')
        sys.exit(1)

    database_url = sys.argv[1]

    # Get the directory where this script is located
    script_dir = os.path.dirname(os.path.abspath(__file__))
    migrations_dir = os.path.join(script_dir, 'migrations')

    # List of migrations in order
    migrations = [
        '001_initial_schema.sql',
        '002_add_admin_users.sql',
        '003_add_security_questions.sql',
        '004_add_schema_fields.sql',
        '005_add_events_deliveries.sql',
        '006_add_subscribers.sql',
        '007_seed_data.sql',
        '008_add_subscriber_id_to_admins.sql'
    ]

    print("🚀 Starting database migrations...")
    print(f"📁 Migrations directory: {migrations_dir}")

    try:
        # Connect to database
        print(f"\n🔌 Connecting to database...")
        conn = psycopg2.connect(database_url)
        conn.autocommit = False
        cursor = conn.cursor()
        print("✅ Connected successfully")

        # Run each migration
        success_count = 0
        for migration_file in migrations:
            filepath = os.path.join(migrations_dir, migration_file)
            if not os.path.exists(filepath):
                print(f"⚠️  Warning: {migration_file} not found, skipping")
                continue

            if run_migration(cursor, filepath):
                conn.commit()
                success_count += 1
            else:
                conn.rollback()
                print(f"\n❌ Migration failed. Rolling back.")
                break

        cursor.close()
        conn.close()

        print(f"\n{'='*50}")
        print(f"✅ Successfully completed {success_count}/{len(migrations)} migrations")
        print(f"{'='*50}")

    except psycopg2.Error as e:
        print(f"\n❌ Database error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
