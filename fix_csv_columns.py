#!/usr/bin/env python3
"""
LIS CSV Column Fixer - ແກ້ໄຂຊື່ Column ໃຫ້ກົງກັບຕາຕະລາງໃໝ່
"""

import csv
from pathlib import Path

CSV_FOLDER = r"C:\Users\Advice_WW\Downloads"

# ກຳນົດ Column ທີ່ຕ້ອງແກ້ໄຂສຳລັບແຕ່ລະຕາຕະລາງ
# format: (old_filename, new_filename, columns_to_keep)
TABLE_CONFIGS = [
    ('users_rows.csv', 'lis_users_fixed.csv', ['id', 'username', 'password', 'role', 'created_at']),
    ('settings_rows.csv', 'lis_settings_fixed.csv', ['id', 'type', 'value', 'created_at']),
    ('test_master_rows.csv', 'lis_test_master_fixed.csv', ['id', 'name', 'price', 'category', 'created_at']),
    ('test_packages_rows.csv', 'lis_test_packages_fixed.csv', ['id', 'name', 'description', 'price', 'is_active', 'created_at']),
    ('test_package_items_rows.csv', 'lis_test_package_items_fixed.csv', ['id', 'package_id', 'test_id', 'test_name', 'price', 'created_at']),
    ('test_parameters_rows.csv', 'lis_test_parameters_fixed.csv', ['id', 'test_name', 'param_name', 'input_type', 'options', 'unit', 'normal_min', 'normal_max', 'created_at']),
    ('stock_master_rows.csv', 'lis_stock_master_fixed.csv', ['id', 'name', 'unit', 'created_at']),
    ('inventory_lots_rows.csv', 'lis_inventory_lots_fixed.csv', ['lot_id', 'reagent_id', 'reagent_name', 'lot_no', 'supplier', 'location', 'receive_date', 'exp_date', 'qty', 'qty_remaining', 'created_at']),  # ໃຊ້ lot_id ແທນ id
    ('stock_transactions_rows.csv', 'lis_stock_transactions_fixed.csv', ['id', 'reagent_id', 'reagent_name', 'type', 'qty', 'note', 'user_name', 'created_at']),
    ('test_orders_rows.csv', 'lis_test_orders_fixed.csv', ['id', 'order_id', 'order_datetime', 'time_slot', 'visit_type', 'insite', 'patient_id', 'patient_name', 'age', 'gender', 'doctor', 'department', 'test_type', 'test_name', 'price', 'total_price', 'lab_dest', 'sender', 'status', 'category', 'note', 'completed_at', 'created_at']),
    ('test_results_rows.csv', 'lis_test_results_fixed.csv', ['id', 'order_id', 'test_name', 'param_name', 'result_value', 'unit', 'normal_min', 'normal_max', 'flag', 'created_at']),
    ('audit_log_rows.csv', 'lis_audit_log_fixed.csv', ['id', 'user_name', 'action', 'target', 'details', 'created_at']),
    ('maintenance_log_rows.csv', 'lis_maintenance_log_fixed.csv', ['id', 'device_name', 'maintenance_date', 'maintenance_type', 'description', 'technician', 'next_due_date', 'status', 'created_at']),
    ('order_attachments_rows.csv', 'lis_order_attachments_fixed.csv', ['id', 'order_id', 'file_name', 'file_type', 'file_data', 'uploaded_by', 'created_at']),
]

def fix_csv(old_filename, new_filename, columns):
    """ແກ້ໄຂ CSV ໂດຍເລືອກສະເພາະ Column ທີ່ຕ້ອງການ"""
    old_path = Path(CSV_FOLDER) / old_filename
    new_path = Path(CSV_FOLDER) / new_filename
    
    if not old_path.exists():
        print(f"  ⚠️  ບໍ່ພົບ: {old_filename}")
        return False
    
    try:
        with open(old_path, 'r', encoding='utf-8') as f_in:
            reader = csv.DictReader(f_in)
            rows = list(reader)
            
            if not rows:
                print(f"  ⚠️  ບໍ່ມີຂໍ້ມູນ: {old_filename}")
                return False
            
            # ກວດວ່າມີ columns ທີ່ຕ້ອງການບໍ່
            available_columns = set(rows[0].keys())
            columns_to_use = [c for c in columns if c in available_columns]
            
            if not columns_to_use:
                print(f"  ❌ ບໍ່ມີ columns ທີ່ຕ້ອງການໃນ {old_filename}")
                return False
            
            # ຂຽນໄຟລ໌ໃໝ່
            with open(new_path, 'w', encoding='utf-8', newline='') as f_out:
                writer = csv.DictWriter(f_out, fieldnames=columns_to_use, extrasaction='ignore')
                writer.writeheader()
                writer.writerows(rows)
            
            print(f"  ✅ {old_filename} → {new_filename} ({len(rows)} rows, {len(columns_to_use)} columns)")
            return True
            
    except Exception as e:
        print(f"  ❌ ຜິດພາດ: {e}")
        return False

def main():
    print("=" * 60)
    print("LIS CSV COLUMN FIXER - ແກ້ໄຂ Column ໃຫ້ກົງກັບຕາຕະລາງໃໝ່")
    print("=" * 60)
    
    fixed_count = 0
    
    for old_file, new_file, columns in TABLE_CONFIGS:
        print(f"\n📁 {old_file}:")
        if fix_csv(old_file, new_file, columns):
            fixed_count += 1
    
    print("\n" + "=" * 60)
    print(f"✅ ສຳເລັດ: {fixed_count}/{len(TABLE_CONFIGS)} ໄຟລ໌")
    print("=" * 60)
    
    print("\n📝 ໄຟລ໌ທີ່ສ້າງແລ້ວ (ໃຊ້ສຳລັບ Import):")
    print("   ທຸກໄຟລ໌ຈະຢູ່ໃນ: C:\\Users\\Advice_WW\\Downloads\\")
    print("   ຊື່ໄຟລ໌: lis_*_fixed.csv")
    
    print("\n📋 ລຳດັບການ Import:")
    print("   1. lis_users_fixed.csv")
    print("   2. lis_settings_fixed.csv")
    print("   3. lis_test_master_fixed.csv")
    print("   4. lis_test_packages_fixed.csv")
    print("   5. lis_test_package_items_fixed.csv")
    print("   6. lis_test_parameters_fixed.csv")
    print("   7. lis_stock_master_fixed.csv")
    print("   8. lis_inventory_lots_fixed.csv")
    print("   9. lis_stock_transactions_fixed.csv")
    print("   10. lis_test_orders_fixed.csv")
    print("   11. lis_test_results_fixed.csv")
    print("   12. lis_audit_log_fixed.csv")
    print("   13. lis_maintenance_log_fixed.csv")
    print("   14. lis_order_attachments_fixed.csv")

if __name__ == '__main__':
    main()
