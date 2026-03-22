#!/usr/bin/env python3
"""
LIS Data Migration Tool - Edge Routing Version
"""

import psycopg2
from psycopg2.extras import RealDictCursor
import sys

# ============================================================
# CONFIGURATION - Using Edge Routing
# ============================================================

# Old LIS Project (qfykgwsrdsdgqymlejdc)
OLD_DB_CONFIG = {
    'host': 'aws-0-ap-southeast-1.pooler.supabase.com',
    'database': 'postgres',
    'user': 'postgres.qfykgwsrdsdgqymlejdc',
    'password': 'Oneadmin@2025',
    'port': 6543,
    'sslmode': 'require'
}

# New it977's Project (erueurkqzmtdefszqons)
NEW_DB_CONFIG = {
    'host': 'aws-0-ap-southeast-1.pooler.supabase.com',
    'database': 'postgres',
    'user': 'postgres.erueurkqzmtdefszqons',
    'password': 'Oneadmin@2025',
    'port': 6543,
    'sslmode': 'require'
}

# Tables to migrate
TABLES = [
    'lis_users',
    'lis_settings',
    'lis_test_master',
    'lis_test_packages',
    'lis_test_package_items',
    'lis_test_parameters',
    'lis_test_reagent_mapping',
    'lis_stock_master',
    'lis_inventory_lots',
    'lis_stock_transactions',
    'lis_test_orders',
    'lis_test_results',
    'lis_audit_log',
    'lis_maintenance_log',
    'lis_order_attachments'
]

def get_connection(config):
    """Create database connection"""
    try:
        conn = psycopg2.connect(**config)
        return conn
    except Exception as e:
        print(f"❌ Connection error: {e}")
        return None

def copy_table(table_name, old_conn, new_conn):
    """Copy data from one table"""
    print(f"\n📋 Copying {table_name}...")
    
    try:
        with old_conn.cursor(cursor_factory=RealDictCursor) as old_cur:
            old_cur.execute(f"SELECT * FROM {table_name}")
            rows = old_cur.fetchall()
            
            if not rows:
                print(f"   ⚠️  No data in {table_name}")
                return 0
        
        columns = list(rows[0].keys())
        inserted = 0
        
        with new_conn.cursor() as new_cur:
            for row in rows:
                try:
                    cols = [c for c in columns if c in row]
                    col_names = ', '.join(f'"{c}"' for c in cols)
                    placeholders = ', '.join(['%s'] * len(cols))
                    conflict_col = 'id' if 'id' in cols else cols[0] if cols else None
                    values = [row[c] for c in cols]
                    
                    if conflict_col:
                        sql = f'INSERT INTO "{table_name}" ({col_names}) VALUES ({placeholders}) ON CONFLICT ("{conflict_col}") DO NOTHING'
                    else:
                        sql = f'INSERT INTO "{table_name}" ({col_names}) VALUES ({placeholders})'
                    
                    new_cur.execute(sql, values)
                    inserted += 1
                except Exception as e:
                    print(f"   ⚠️  Error: {e}")
                    continue
        
        new_conn.commit()
        print(f"   ✅ Copied {inserted}/{len(rows)} rows")
        return inserted
        
    except Exception as e:
        print(f"   ❌ Error: {e}")
        new_conn.rollback()
        return 0

def main():
    print("=" * 60)
    print("LIS DATA MIGRATION TOOL")
    print("=" * 60)
    
    print("\n🔌 Connecting to OLD database (LIS Project)...")
    old_conn = get_connection(OLD_DB_CONFIG)
    if not old_conn:
        print("\n❌ Cannot connect to old database!")
        print("\nPlease check:")
        print("1. Go to: https://supabase.com/dashboard/project/qfykgwsrdsdgqymlejdc/settings/database")
        print("2. Copy the Connection Pooling string")
        print("3. Update OLD_DB_CONFIG in migrate_simple.py")
        sys.exit(1)
    print("   ✅ Connected!")
    
    print("\n🔌 Connecting to NEW database (it977's Project)...")
    new_conn = get_connection(NEW_DB_CONFIG)
    if not new_conn:
        print("\n❌ Cannot connect to new database!")
        print("\nPlease check:")
        print("1. Go to: https://supabase.com/dashboard/project/erueurkqzmtdefszqons/settings/database")
        print("2. Copy the Connection Pooling string")
        print("3. Update NEW_DB_CONFIG in migrate_simple.py")
        old_conn.close()
        sys.exit(1)
    print("   ✅ Connected!")
    
    total_tables = len(TABLES)
    total_rows = 0
    
    for i, table in enumerate(TABLES, 1):
        print(f"\n[{i}/{total_tables}]", end=' ')
        rows = copy_table(table, old_conn, new_conn)
        total_rows += rows
    
    old_conn.close()
    new_conn.close()
    
    print("\n" + "=" * 60)
    print(f"✅ MIGRATION COMPLETE!")
    print(f"   Tables: {total_tables}")
    print(f"   Rows: {total_rows}")
    print("=" * 60)

if __name__ == '__main__':
    main()
