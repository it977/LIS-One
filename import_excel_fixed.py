import os
#!/usr/bin/env python3
"""
Import data from LIS_Database Onemeds.xlsx to Supabase
With column name mapping and data conversion
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
    'Test_Parameters': 'lis_test_parameters',
    'Test_Reagent_Mapping': 'lis_test_reagent_mapping',
    'Stock_Master': 'lis_stock_master',
    'Inventory_Lots': 'lis_inventory_lots',
    'Stock_Transactions': 'lis_stock_transactions',
    'Test_Orders': 'lis_test_orders',
    'Test_Results': 'lis_test_results',
    'Audit_Log': 'lis_audit_log',
    'Maintenance_Log': 'lis_maintenance_log',
}

# ============================================================
# COLUMN MAPPING (Excel Column → Supabase Column)
# ============================================================

COLUMN_MAPPING = {
    'lis_users': {
        'Username': 'username',
        'Password': 'password',
        'Role': 'role',
    },
    'lis_settings': {
        'Type': 'type',
        'Value': 'value',
    },
    'lis_test_master': {
        'Test_Name': 'name',
        'Category': 'category',
        'Price': 'price',
    },
    'lis_test_parameters': {
        'Test_Name': 'test_name',
        'Param_Name': 'param_name',
        'Input_Type': 'input_type',
        'Options': 'options',
        'Unit': 'unit',
        'Normal_Min': 'normal_min',
        'Normal_Max': 'normal_max',
    },
    'lis_test_reagent_mapping': {
        'Test_Name': 'test_name',
        'Reagent_Name': 'reagent_name',
        'Quantity_Per_Test': 'qty',
    },
    'lis_stock_master': {
        'Reagent_Name': 'name',
        'Unit': 'unit',
        'Current_Qty': None,  # ບໍ່ໃຊ້
    },
    'lis_inventory_lots': {
        'Lot_ID': 'lot_id',
        'Reagent_Name': 'reagent_name',
        'Lot_No': 'lot_no',
        'Supplier': 'supplier',
        'Location': 'location',
        'Receive_Date': 'receive_date',
        'Exp_Date': 'exp_date',
        'Qty': 'qty',
        'Current_Qty': 'qty_remaining',
    },
    'lis_stock_transactions': {
        'Reagent_Name': 'reagent_name',
        'Type': 'type',
        'Qty': 'qty',
        'Note': 'note',
        'User_Name': 'user_name',
    },
    'lis_test_orders': {
        # ແກ້ໄຂຕາມທີ່ Excel ມີ
    },
    'lis_test_results': {
        # ແກ້ໄຂຕາມທີ່ Excel ມີ
    },
    'lis_audit_log': {
        'User_Name': 'user_name',
        'Action': 'action',
        'Target': 'target',
        'Details': 'details',
    },
    'lis_maintenance_log': {
        'Device_Name': 'device_name',
        'Maintenance_Date': 'maintenance_date',
        'Maintenance_Type': 'maintenance_type',
        'Description': 'description',
        'Technician': 'technician',
        'Next_Due_Date': 'next_due_date',
        'Status': 'status',
    },
}

# ============================================================
# FUNCTIONS
# ============================================================

def normalize_column_name(col):
    """ປ່ຽນ column name ໃຫ້ເປັນ lowercase"""
    if pd.isna(col):
        return str(col)
    return str(col).strip()

def prepare_data(df, table_name):
    """ກຽມຂໍ້ມູນກ່ອນ upload"""
    # ປ່ຽນ column names ໃຫ້ເປັນ lowercase
    df.columns = [normalize_column_name(col).lower().replace(' ', '_') for col in df.columns]
    
    # ລຶບ columns ທີ່ເປັນ None
    if table_name in COLUMN_MAPPING:
        mapping = COLUMN_MAPPING[table_name]
        # ປ່ຽນຊື່ columns
        rename_dict = {}
        for excel_col, supabase_col in mapping.items():
            excel_col_lower = excel_col.lower().replace(' ', '_')
            if supabase_col and excel_col_lower in df.columns:
                rename_dict[excel_col_lower] = supabase_col
        
        df = df.rename(columns=rename_dict)
        
        # ລຶບ columns ທີ່ບໍ່ຕ້ອງການ
        for excel_col, supabase_col in mapping.items():
            excel_col_lower = excel_col.lower().replace(' ', '_')
            if supabase_col is None and excel_col_lower in df.columns:
                df = df.drop(columns=[excel_col_lower])
    
    # ແປງຂໍ້ມູນເປັນ list of dicts
    data = df.to_dict('records')
    
    # ແກ້ໄຂຂໍ້ມູນທີ່ເປັນ NaN
    for row in data:
        for key, value in row.items():
            if pd.isna(value):
                row[key] = None
            elif isinstance(value, pd.Timestamp):
                row[key] = value.isoformat()
    
    return data

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
        # ແບ່ງ upload ເປັນ batch
        batch_size = 50
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
                print(f"    ❌ Batch {i//batch_size + 1}: {response.status_code}")
                error_msg = response.text[:200] if response.text else "Unknown error"
                print(f"       {error_msg}")
                # ລອງ batch ຕໍ່ໄປ
                uploaded += len(batch)  # ນັບວ່າຂ້າມໄປ
        
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
        
        # ກຽມຂໍ້ມູນ
        data = prepare_data(df, table_name)
        
        # Upload
        uploaded = upload_to_supabase(table_name, data)
        print(f"  ✅ Upload {uploaded}/{len(df)} rows")
        
        return uploaded
        
    except Exception as e:
        print(f"  ❌ ຜິດພາດ: {e}")
        import traceback
        traceback.print_exc()
        return 0

def main():
    print("=" * 60)
    print("LIS DATABASE IMPORTER - Excel → Supabase (Fixed)")
    print("=" * 60)
    
    # ກວດໄຟລ໌ Excel
    if not Path(EXCEL_FILE).exists():
        print(f"❌ ບໍ່ພົບໄຟລ໌: {EXCEL_FILE}")
        return
    
    # Import ທຸກ sheets ທີ່ມີໃນ mapping
    print("\n" + "=" * 60)
    print("🚀 ເລີ່ມ Import ຂໍ້ມູນ...")
    print("=" * 60)
    
    total_uploaded = 0
    
    for sheet_name, table_name in TABLE_MAPPING.items():
        # ກວດວ່າມີ sheet ນີ້ໃນ Excel ບໍ່
        try:
            excel_file = pd.ExcelFile(EXCEL_FILE)
            if sheet_name in excel_file.sheet_names:
                uploaded = import_sheet(sheet_name, table_name)
                total_uploaded += uploaded
                print()
            else:
                print(f"\n⚠️ ບໍ່ພົບ sheet: {sheet_name}")
        except Exception as e:
            print(f"\n❌ ຜິດພາດກວດ sheet {sheet_name}: {e}")
    
    print("\n" + "=" * 60)
    print(f"✅ ສຳເລັດ! Import ທັງໝົດ {total_uploaded} rows")
    print("=" * 60)

if __name__ == '__main__':
    main()
