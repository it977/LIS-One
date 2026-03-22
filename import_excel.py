import os
#!/usr/bin/env python3
"""
Import data from LIS_Database Onemeds.xlsx to Supabase
"""

import pandas as pd
import requests
import json
from pathlib import Path

# ============================================================
# CONFIGURATION
# ============================================================

EXCEL_FILE = r"C:\Users\Advice_WW\Downloads\LIS_Database Onemeds.xlsx"
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

# ============================================================
# TABLE MAPPING (Excel Sheet Name → Supabase Table)
# ============================================================

TABLE_MAPPING = {
    'Users': 'lis_users',
    'Settings': 'lis_settings',
    'Test_Master': 'lis_test_master',
    'Test_Packages': 'lis_test_packages',
    'Test_Package_Items': 'lis_test_package_items',
    'Test_Parameters': 'lis_test_parameters',
    'Test_Reagent_Mapping': 'lis_test_reagent_mapping',
    'Stock_Master': 'lis_stock_master',
    'Inventory_Lots': 'lis_inventory_lots',
    'Stock_Transactions': 'lis_stock_transactions',
    'Test_Orders': 'lis_test_orders',
    'Test_Results': 'lis_test_results',
    'Audit_Log': 'lis_audit_log',
    'Maintenance_Log': 'lis_maintenance_log',
    'Order_Attachments': 'lis_order_attachments',
}

# ============================================================
# FUNCTIONS
# ============================================================

def read_excel_sheets(filepath):
    """ອ່ານທຸກ sheets ຈາກ Excel"""
    try:
        excel_file = pd.ExcelFile(filepath)
        sheets = excel_file.sheet_names
        print(f"📊 ພົບ {len(sheets)} sheets:")
        for i, sheet in enumerate(sheets, 1):
            print(f"   {i}. {sheet}")
        return sheets
    except Exception as e:
        print(f"❌ ຜິດພາດອ່ານ Excel: {e}")
        return []

def upload_to_supabase(table_name, data):
    """Upload ຂໍ້ມູນຂຶ້ນ Supabase"""
    if not data:
        print(f"  ⚠️ ບໍ່ມີຂໍ້ມູນ")
        return 0
    
    url = f"{SUPABASE_URL}/rest/v1/{table_name}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }
    
    try:
        # ແບ່ງ upload ເປັນ batch (100 rows ຕໍ່ batch)
        batch_size = 100
        uploaded = 0
        
        for i in range(0, len(data), batch_size):
            batch = data[i:i+batch_size]
            
            # ແປງເປັນ JSON
            json_data = json.dumps(batch, default=str)
            
            response = requests.post(url, headers=headers, data=json_data)
            
            if response.status_code in [200, 201, 204]:
                uploaded += len(batch)
                print(f"    ✓ Batch {i//batch_size + 1}: {len(batch)} rows")
            else:
                print(f"    ⚠️ Batch {i//batch_size + 1}: {response.status_code}")
                print(f"       {response.text[:200]}")
        
        return uploaded
        
    except Exception as e:
        print(f"  ❌ ຜິດພາດ: {e}")
        return 0

def import_sheet(sheet_name, table_name):
    """Import ຂໍ້ມູນຈາກ sheet ໜຶ່ງ"""
    print(f"\n📊 {sheet_name} → {table_name}:")
    
    try:
        # ອ່ານ Excel
        df = pd.read_excel(EXCEL_FILE, sheet_name=sheet_name)
        print(f"  📄 ອ່ານໄດ້ {len(df)} rows, {len(df.columns)} columns")
        
        if len(df) == 0:
            print(f"  ⚠️ ບໍ່ມີຂໍ້ມູນ")
            return 0
        
        # ແປງເປັນ list of dicts
        data = df.to_dict('records')
        
        # Upload
        uploaded = upload_to_supabase(table_name, data)
        print(f"  ✅ Upload {uploaded}/{len(df)} rows")
        
        return uploaded
        
    except Exception as e:
        print(f"  ❌ ຜິດພາດ: {e}")
        return 0

def main():
    print("=" * 60)
    print("LIS DATABASE IMPORTER - Excel → Supabase")
    print("=" * 60)
    
    # ກວດໄຟລ໌ Excel
    if not Path(EXCEL_FILE).exists():
        print(f"❌ ບໍ່ພົບໄຟລ໌: {EXCEL_FILE}")
        return
    
    # ອ່ານ sheets
    sheets = read_excel_sheets(EXCEL_FILE)
    
    if not sheets:
        print("\n❌ ບໍ່ມີ sheets ໃນ Excel!")
        return
    
    # Import ທຸກ sheets ທີ່ມີໃນ mapping
    print("\n" + "=" * 60)
    print("🚀 ເລີ່ມ Import ຂໍ້ມູນ...")
    print("=" * 60)
    
    total_uploaded = 0
    
    for sheet_name, table_name in TABLE_MAPPING.items():
        if sheet_name in sheets:
            uploaded = import_sheet(sheet_name, table_name)
            total_uploaded += uploaded
            print()
        else:
            print(f"\n⚠️ ບໍ່ພົບ sheet: {sheet_name}")
    
    print("\n" + "=" * 60)
    print(f"✅ ສຳເລັດ! Import ທັງໝົດ {total_uploaded} rows")
    print("=" * 60)
    
    print("\n📝 ຂັ້ນຕອນຕໍ່ໄປ:")
    print("   1. ເຂົ້າ Supabase Dashboard ກວດເບິ່ງຂໍ້ມູນ")
    print("   2. ຖ້າມີຂໍ້ຜິດພາດ ແຈ້ງຂ້ອຍ")
    print("   3. ທົດສອບ Application")

if __name__ == '__main__':
    main()
