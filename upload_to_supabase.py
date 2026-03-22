import os
#!/usr/bin/env python3
"""
LIS Data Uploader - ອັບໂຫລດຂໍ້ມູນຈາກ CSV ຂຶ້ນ Supabase
"""

import csv
import requests
from pathlib import Path
import time

# ============================================================
# CONFIGURATION
# ============================================================

# Supabase Project (it977's Project)
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

# ໂຟນເດີທີ່ເກັບ CSV ໄຟລ໌
CSV_FOLDER = r"C:\Users\Advice_WW\Downloads"

# ຕາຕະລາງ ແລະ ໄຟລ໌ CSV
TABLES = [
    ('lis_users', 'lis_users_fixed.csv', ['id', 'username', 'password', 'role', 'created_at']),
    ('lis_settings', 'lis_settings_fixed.csv', ['id', 'type', 'value', 'created_at']),
    ('lis_test_master', 'lis_test_master_fixed.csv', ['id', 'name', 'price', 'category', 'created_at']),
    ('lis_test_packages', 'lis_test_packages_fixed.csv', ['id', 'name', 'description', 'price', 'is_active', 'created_at']),
    ('lis_test_package_items', 'lis_test_package_items_fixed.csv', ['id', 'package_id', 'test_id', 'test_name', 'price', 'created_at']),
    ('lis_test_parameters', 'lis_test_parameters_fixed.csv', ['id', 'test_name', 'param_name', 'input_type', 'options', 'unit', 'normal_min', 'normal_max', 'created_at']),
    ('lis_stock_master', 'lis_stock_master_fixed.csv', ['id', 'name', 'unit', 'created_at']),
    ('lis_inventory_lots', 'lis_inventory_lots_fixed.csv', ['lot_id', 'reagent_id', 'reagent_name', 'lot_no', 'supplier', 'location', 'receive_date', 'exp_date', 'qty', 'qty_remaining', 'created_at']),
    ('lis_stock_transactions', 'lis_stock_transactions_fixed.csv', ['id', 'reagent_id', 'reagent_name', 'type', 'qty', 'note', 'user_name', 'created_at']),
    ('lis_test_orders', 'lis_test_orders_fixed.csv', ['id', 'order_id', 'order_datetime', 'time_slot', 'visit_type', 'insite', 'patient_id', 'patient_name', 'age', 'gender', 'doctor', 'department', 'test_type', 'test_name', 'price', 'total_price', 'lab_dest', 'sender', 'status', 'category', 'note', 'completed_at', 'created_at']),
    ('lis_test_results', 'lis_test_results_fixed.csv', ['id', 'order_id', 'test_name', 'param_name', 'result_value', 'unit', 'normal_min', 'normal_max', 'flag', 'created_at']),
    ('lis_audit_log', 'lis_audit_log_fixed.csv', ['id', 'user_name', 'action', 'target', 'details', 'created_at']),
    ('lis_maintenance_log', 'lis_maintenance_log_fixed.csv', ['id', 'device_name', 'maintenance_date', 'maintenance_type', 'description', 'technician', 'next_due_date', 'status', 'created_at']),
]

# ============================================================
# FUNCTIONS
# ============================================================

def read_csv(filepath, columns):
    """ອ່ານຂໍ້ມູນຈາກ CSV"""
    rows = []
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # ເລືອກສະເພາະ columns ທີ່ຕ້ອງການ
                filtered_row = {col: row.get(col, '') for col in columns}
                
                # ແປງຄ່າ NULL
                for key, value in filtered_row.items():
                    if value == '' or value is None:
                        filtered_row[key] = None
                    elif value.lower() == 'null':
                        filtered_row[key] = None
                
                rows.append(filtered_row)
        return rows
    except Exception as e:
        print(f"  ❌ ຜິດພາດອ່ານໄຟລ໌: {e}")
        return []

def upload_to_supabase(table_name, rows):
    """ອັບໂຫລດຂໍ້ມູນຂຶ້ນ Supabase"""
    if not rows:
        print(f"  ⚠️  ບໍ່ມີຂໍ້ມູນ")
        return 0
    
    url = f"{SUPABASE_URL}/rest/v1/{table_name}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"  # ຂ້າມຂໍ້ມູນທີ່ຊ້ຳ
    }
    
    try:
        # ແບ່ງອັບໂຫລດເປັນ batch (100 rows ຕໍ່ batch)
        batch_size = 100
        uploaded = 0
        
        for i in range(0, len(rows), batch_size):
            batch = rows[i:i+batch_size]
            
            response = requests.post(url, headers=headers, json=batch)
            
            if response.status_code in [200, 201, 204]:
                uploaded += len(batch)
                print(f"    ✓ Batch {i//batch_size + 1}: {len(batch)} rows")
            else:
                print(f"    ⚠️  Batch {i//batch_size + 1}: {response.status_code} - {response.text[:100]}")
        
        return uploaded
        
    except Exception as e:
        print(f"  ❌ ຜິດພາດ: {e}")
        return 0

def upload_table(table_name, csv_filename, columns):
    """ອັບໂຫລດຕາຕະລາງດຽວ"""
    csv_path = Path(CSV_FOLDER) / csv_filename
    
    print(f"\n📊 {table_name} ({csv_filename}):")
    
    if not csv_path.exists():
        print(f"  ⚠️  ບໍ່ພົບໄຟລ໌: {csv_filename}")
        return 0
    
    # ອ່ານ CSV
    rows = read_csv(csv_path, columns)
    print(f"  📄 ອ່ານໄດ້ {len(rows)} rows")
    
    # ອັບໂຫລດ
    uploaded = upload_to_supabase(table_name, rows)
    print(f"  ✅ ອັບໂຫລດ {uploaded}/{len(rows)} rows")
    
    return uploaded

def main():
    print("=" * 60)
    print("LIS DATA UPLOADER - ອັບໂຫລດຂໍ້ມູນຂຶ້ນ Supabase")
    print("=" * 60)
    print(f"\n📡 Supabase URL: {SUPABASE_URL}")
    print(f"📂 CSV Folder: {CSV_FOLDER}")
    
    total_uploaded = 0
    total_tables = len(TABLES)
    
    for i, (table, csv_file, columns) in enumerate(TABLES, 1):
        print(f"\n{'='*60}")
        print(f"[{i}/{total_tables}] ", end='')
        uploaded = upload_table(table, csv_file, columns)
        total_uploaded += uploaded
        
        # ລໍຖ້າ 1 ວິນາທີ ລະຫວ່າງຕາຕະລາງ
        time.sleep(1)
    
    print("\n" + "=" * 60)
    print(f"✅ ສຳເລັດ! ອັບໂຫລດທັງໝົດ {total_uploaded} rows")
    print("=" * 60)
    
    print("\n📝 ຂັ້ນຕອນຕໍ່ໄປ:")
    print("   1. ເຂົ້າ Supabase Dashboard ກວດເບິ່ງຂໍ້ມູນ")
    print("   2. ຖ້າມີຂໍ້ຜິດພາດ ແຈ້ງຂ້ອຍ")
    print("   3. ທົດສອບ Application")

if __name__ == '__main__':
    main()
