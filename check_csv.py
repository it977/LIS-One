#!/usr/bin/env python3
"""
LIS CSV Column Checker - ກວດເບິ່ງຊື່ Column ໃນ CSV
"""

import csv
from pathlib import Path

CSV_FOLDER = r"C:\Users\Advice_WW\Downloads"

# ລາຍຊື່ໄຟລ໌ທີ່ຕ້ອງກວດ
FILES_TO_CHECK = [
    'inventory_lots_rows.csv',
    'stock_transactions_rows.csv',
    'test_orders_rows.csv',
    'test_packages_rows.csv',
    'test_package_items_rows.csv',
    'test_parameters_rows.csv',
    'stock_master_rows.csv',
    'test_master_rows.csv',
    'settings_rows.csv',
    'users_rows.csv',
]

def check_csv(filepath):
    """ກວດເບິ່ງ headers ຂອງ CSV"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            header = f.readline().strip()
            columns = header.split(',')
            
            print(f"\n📁 {filepath.name}:")
            print(f"   Columns ({len(columns)}): {columns}")
            
            return columns
    except Exception as e:
        print(f"  ❌ ຜິດພາດ: {e}")
        return None

def main():
    print("=" * 60)
    print("LIS CSV COLUMN CHECKER")
    print("=" * 60)
    
    csv_folder = Path(CSV_FOLDER)
    
    for filename in FILES_TO_CHECK:
        filepath = csv_folder / filename
        if filepath.exists():
            check_csv(filepath)
        else:
            print(f"\n⚠️  ບໍ່ພົບ: {filename}")
    
    print("\n" + "=" * 60)

if __name__ == '__main__':
    main()
