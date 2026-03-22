import os
#!/usr/bin/env python3
"""
Upload remaining data - ອັບໂຫລດຂໍ້ມູນທີ່ເຫຼືອ
"""

import csv
import requests
from pathlib import Path
import time

# ============================================================
# CONFIGURATION
# ============================================================

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
CSV_FOLDER = r"C:\Users\Advice_WW\Downloads"

# ຕາຕະລາງທີ່ຕ້ອງອັບໂຫລດຕໍ່
TABLES = [
    # ແກ້ໄຂ inventory_lots (ໃຊ້ໄຟລ໌ໃໝ່)
    ('lis_inventory_lots', 'lis_inventory_lots_fixed2.csv', ['lot_id', 'reagent_id', 'reagent_name', 'lot_no', 'supplier', 'location', 'receive_date', 'exp_date', 'qty', 'qty_remaining', 'created_at']),
    
    # ລອງ test_orders ໃໝ່ (ຈະຂ້າມຂໍ້ມູນທີ່ຊ້ຳ)
    ('lis_test_orders', 'lis_test_orders_fixed.csv', ['id', 'order_id', 'order_datetime', 'time_slot', 'visit_type', 'insite', 'patient_id', 'patient_name', 'age', 'gender', 'doctor', 'department', 'test_type', 'test_name', 'price', 'total_price', 'lab_dest', 'sender', 'status', 'category', 'note', 'completed_at', 'created_at']),
    
    # maintenance_log (ລອງໃໝ່)
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
                filtered_row = {col: row.get(col, '') for col in columns}
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
        batch_size = 100
        uploaded = 0
        skipped = 0
        
        for i in range(0, len(rows), batch_size):
            batch = rows[i:i+batch_size]
            response = requests.post(url, headers=headers, json=batch)
            
            if response.status_code in [200, 201, 204]:
                uploaded += len(batch)
                print(f"    ✓ Batch {i//batch_size + 1}: {len(batch)} rows")
            elif response.status_code == 409:
                # Conflict - ຂໍ້ມູນຊ້ຳ
                skipped += len(batch)
                print(f"    ⚠️ Batch {i//batch_size + 1}: ຂໍ້ມູນຊ້ຳ (skipped)")
            else:
                print(f"    ❌ Batch {i//batch_size + 1}: {response.status_code}")
                print(f"       {response.text[:200]}")
        
        return uploaded, skipped
        
    except Exception as e:
        print(f"  ❌ ຜິດພາດ: {e}")
        return 0, 0

def upload_table(table_name, csv_filename, columns):
    """ອັບໂຫລດຕາຕະລາງດຽວ"""
    csv_path = Path(CSV_FOLDER) / csv_filename
    
    print(f"\n📊 {table_name} ({csv_filename}):")
    
    if not csv_path.exists():
        print(f"  ⚠️ ບໍ່ພົບໄຟລ໌: {csv_filename}")
        return 0, 0
    
    rows = read_csv(csv_path, columns)
    print(f"  📄 ອ່ານໄດ້ {len(rows)} rows")
    
    uploaded, skipped = upload_to_supabase(table_name, rows)
    print(f"  ✅ ອັບໂຫລດ {uploaded}, ຂ້າມ {skipped}/{len(rows)} rows")
    
    return uploaded, skipped

def main():
    print("=" * 60)
    print("UPLOAD REMAINING DATA - ອັບໂຫລດຂໍ້ມູນທີ່ເຫຼືອ")
    print("=" * 60)
    
    total_uploaded = 0
    total_skipped = 0
    
    for i, (table, csv_file, columns) in enumerate(TABLES, 1):
        print(f"\n{'='*60}")
        print(f"[{i}/{len(TABLES)}] ", end='')
        uploaded, skipped = upload_table(table, csv_file, columns)
        total_uploaded += uploaded
        total_skipped += skipped
        time.sleep(1)
    
    print("\n" + "=" * 60)
    print(f"✅ ສຳເລັດ! ອັບໂຫລດ {total_uploaded}, ຂ້າມ {total_skipped} rows")
    print("=" * 60)

if __name__ == '__main__':
    main()
