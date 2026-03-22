#!/usr/bin/env python3
"""
LIS Data Migration Tool - Simple Version
Copy all data from old LIS project to new it977's Project
"""

import psycopg2
from psycopg2.extras import RealDictCursor
import sys

# ============================================================
# CONFIGURATION
# ============================================================

# Connection URIs
OLD_DB_URI = "postgresql://postgres:Oneadmin%402025@db.qfykgwsrdsdgqymlejdc.supabase.co:5432/postgres?sslmode=require"
NEW_DB_URI = "postgresql://postgres:Oneadmin%402025@db.erueurkqzmtdefszqons.supabase.co:5432/postgres?sslmode=require"

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

# ============================================================
# MIGRATION FUNCTIONS
# ============================================================

def get_connection(uri):
    """Create database connection"""
    try:
        return psycopg2.connect(uri)
    except Exception as e:
        print(f"❌ Connection error: {e}")
        sys.exit(1)

def copy_table(table_name, old_conn, new_conn):
    """Copy data from one table"""
    print(f"\n📋 Copying {table_name}...")
    
    try:
        # Get data from old database
        with old_conn.cursor(cursor_factory=RealDictCursor) as old_cur:
            old_cur.execute(f"SELECT * FROM {table_name}")
            rows = old_cur.fetchall()
            
            if not rows:
                print(f"   ⚠️  No data in {table_name}")
                return 0
        
        # Get column names
        columns = list(rows[0].keys())
        
        # Insert into new database
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
                        sql = f'''
                            INSERT INTO "{table_name}" ({col_names}) 
                            VALUES ({placeholders})
                            ON CONFLICT ("{conflict_col}") DO NOTHING
                        '''
                    else:
                        sql = f'INSERT INTO "{table_name}" ({col_names}) VALUES ({placeholders})'
                    
                    new_cur.execute(sql, values)
                    inserted += 1
                except Exception as e:
                    print(f"   ⚠️  Error inserting row: {e}")
                    continue
        
        new_conn.commit()
        print(f"   ✅ Copied {inserted}/{len(rows)} rows")
        return inserted
        
    except Exception as e:
        print(f"   ❌ Error copying {table_name}: {e}")
        new_conn.rollback()
        return 0

def main():
    print("=" * 60)
    print("LIS DATA MIGRATION TOOL")
    print("Copy data from LIS Project → it977's Project")
    print("=" * 60)
    
    # Connect to both databases
    print("\n🔌 Connecting to old database (LIS Project)...")
    old_conn = get_connection(OLD_DB_URI)
    print("   ✅ Connected!")
    
    print("\n🔌 Connecting to new database (it977's Project)...")
    new_conn = get_connection(NEW_DB_URI)
    print("   ✅ Connected!")
    
    # Copy each table
    total_tables = len(TABLES)
    total_rows = 0
    
    for i, table in enumerate(TABLES, 1):
        print(f"\n[{i}/{total_tables}]", end=' ')
        rows = copy_table(table, old_conn, new_conn)
        total_rows += rows
    
    # Close connections
    old_conn.close()
    new_conn.close()
    
    print("\n" + "=" * 60)
    print(f"✅ MIGRATION COMPLETE!")
    print(f"   Tables processed: {total_tables}")
    print(f"   Total rows copied: {total_rows}")
    print("=" * 60)
    
    print("\n📝 Next steps:")
    print("   1. Go to Supabase Dashboard → it977's Project")
    print("   2. Check Table Editor to verify data")
    print("   3. Make sure RLS is disabled for all lis_* tables")
    print("   4. Test the application")

if __name__ == '__main__':
    main()
