#!/usr/bin/env python3
"""
LIS CSV Fixer - ແກ້ໄຂຊື່ Column ໃນ CSV ໃຫ້ກົງກັບຕາຕະລາງໃໝ່
"""

import csv
import os
from pathlib import Path

# ໂຟນເດີທີ່ເກັບ CSV ໄຟລ໌
CSV_FOLDER = r"C:\Users\Advice_WW\Downloads"

# ກຳນົດຊື່ Column ເກົ່າ → ໃໝ່ ສຳລັບແຕ່ລະຕາຕະລາງ
COLUMN_MAPPING = {
    'users_rows.csv': {
        'new_name': 'lis_users_rows.csv',
        'columns': ['id', 'username', 'password', 'role', 'created_at']
    },
    'settings_rows.csv': {
        'new_name': 'lis_settings_rows.csv',
        'columns': ['id', 'type', 'value', 'created_at']
    },
    'test_master_rows.csv': {
        'new_name': 'lis_test_master_rows.csv',
        'columns': ['id', 'name', 'price', 'category', 'created_at']
    },
    'test_packages_rows.csv': {
        'new_name': 'lis_test_packages_rows.csv',
        'columns': ['id', 'name', 'description', 'price', 'is_active', 'created_at']
    },
    'test_package_items_rows.csv': {
        'new_name': 'lis_test_package_items_rows.csv',
        'columns': ['id', 'package_id', 'test_id', 'test_name', 'price', 'created_at']
    },
    'test_parameters_rows.csv': {
        'new_name': 'lis_test_parameters_rows.csv',
        'columns': ['id', 'test_name', 'param_name', 'input_type', 'options', 'unit', 'normal_min', 'normal_max', 'created_at']
    },
    'test_reagent_mapping_rows.csv': {
        'new_name': 'lis_test_reagent_mapping_rows.csv',
        'columns': ['id', 'test_name', 'reagent_id', 'reagent_name', 'qty', 'created_at']
    },
    'stock_master_rows.csv': {
        'new_name': 'lis_stock_master_rows.csv',
        'columns': ['id', 'name', 'unit', 'created_at']
    },
    'inventory_lots_rows.csv': {
        'new_name': 'lis_inventory_lots_rows.csv',
        'columns': ['lot_id', 'reagent_id', 'reagent_name', 'lot_no', 'supplier', 'location', 'receive_date', 'exp_date', 'qty', 'qty_remaining', 'created_at']
    },
    'stock_transactions_rows.csv': {
        'new_name': 'lis_stock_transactions_rows.csv',
        'columns': ['id', 'reagent_id', 'reagent_name', 'type', 'qty', 'note', 'user_name', 'created_at']
    },
    'test_orders_rows.csv': {
        'new_name': 'lis_test_orders_rows.csv',
        'columns': ['id', 'order_id', 'order_datetime', 'time_slot', 'visit_type', 'insite', 'patient_id', 'patient_name', 'age', 'gender', 'doctor', 'department', 'test_type', 'test_name', 'price', 'total_price', 'lab_dest', 'sender', 'status', 'category', 'note', 'completed_at', 'created_at']
    },
    'test_results_rows.csv': {
        'new_name': 'lis_test_results_rows.csv',
        'columns': ['id', 'order_id', 'test_name', 'param_name', 'result_value', 'unit', 'normal_min', 'normal_max', 'flag', 'created_at']
    },
    'audit_log_rows.csv': {
        'new_name': 'lis_audit_log_rows.csv',
        'columns': ['id', 'user_name', 'action', 'target', 'details', 'created_at']
    },
    'maintenance_log_rows.csv': {
        'new_name': 'lis_maintenance_log_rows.csv',
        'columns': ['id', 'device_name', 'maintenance_date', 'maintenance_type', 'description', 'technician', 'next_due_date', 'status', 'created_at']
    },
    'order_attachments_rows.csv': {
        'new_name': 'lis_order_attachments_rows.csv',
        'columns': ['id', 'order_id', 'file_name', 'file_type', 'file_data', 'uploaded_by', 'created_at']
    }
}

def fix_csv_file(old_path, new_path, columns):
    """ແກ້ໄຂ CSV ໄຟລ໌"""
    try:
        # ອ່ານໄຟລ໌ເກົ່າ
        with open(old_path, 'r', encoding='utf-8') as f:
            # ອ່ານແຖວທຳອິດ (headers)
            first_line = f.readline().strip()
            
            # ກວດວ່າມີ headers ບໍ່
            if first_line.lower().startswith('id,') or first_line.lower().startswith('lot_id,'):
                # ມີ headers ແລ້ວ - ບໍ່ຕ້ອງແກ້
                print(f"  ⚠️  {old_path.name} ມີ headers ແລ້ວ")
                return False
            else:
                # ບໍ່ມີ headers - ຕ້ອງເພີ່ມ
                f.seek(0)
                data = f.read()
        
        # ຂຽນໄຟລ໌ໃໝ່ພ້ອມ headers
        with open(new_path, 'w', encoding='utf-8') as f:
            # ຂຽນ headers
            f.write(','.join(columns) + '\n')
            # ຂຽນຂໍ້ມູນ
            f.write(data)
        
        print(f"  ✅ ແກ້ໄຂ: {old_path.name} → {new_path.name}")
        return True
        
    except Exception as e:
        print(f"  ❌ ຜິດພາດ: {old_path.name} - {e}")
        return False

def main():
    print("=" * 60)
    print("LIS CSV FIXER - ແກ້ໄຂຊື່ Column ໃຫ້ກົງກັບຕາຕະລາງໃໝ່")
    print("=" * 60)
    
    csv_folder = Path(CSV_FOLDER)
    
    if not csv_folder.exists():
        print(f"❌ ບໍ່ພົບໂຟນເດີ: {CSV_FOLDER}")
        return
    
    fixed_count = 0
    
    for old_name, config in COLUMN_MAPPING.items():
        old_path = csv_folder / old_name
        new_name = config['new_name']
        new_path = csv_folder / new_name
        columns = config['columns']
        
        if old_path.exists():
            print(f"\n📁 {old_name}:")
            if fix_csv_file(old_path, new_path, columns):
                fixed_count += 1
        else:
            print(f"  ⚠️  ບໍ່ພົບ: {old_name}")
    
    print("\n" + "=" * 60)
    print(f"✅ ສຳເລັດ: {fixed_count}/{len(COLUMN_MAPPING)} ໄຟລ໌")
    print("=" * 60)
    
    print("\n📝 ຄຳແນະນຳ:")
    print("   1. ໄຟລ໌ໃໝ່ຈະຖືກບັນທຶກໃນໂຟນເດີ Downloads")
    print("   2. ໃຊ້ໄຟລ໌ໃໝ່ (lis_*_rows.csv) ສຳລັບ Import")
    print("   3. ຖ້າມີບັນຫາ ໃຫ້ລອງເປີດໄຟລ໌ກວດເບິ່ງກ່ອນ")

if __name__ == '__main__':
    main()
