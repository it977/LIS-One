#!/usr/bin/env python3
"""
Remove duplicate order_ids from CSV
"""

import csv
from pathlib import Path

CSV_FOLDER = r"C:\Users\Advice_WW\Downloads"
input_file = Path(CSV_FOLDER) / "lis_test_orders_fixed.csv"
output_file = Path(CSV_FOLDER) / "lis_test_orders_no_duplicates.csv"

# ອ່ານຂໍ້ມູນ
rows = []
seen_order_ids = set()

with open(input_file, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        order_id = row.get('order_id', '')
        if order_id and order_id not in seen_order_ids:
            rows.append(row)
            seen_order_ids.add(order_id)

# ຂຽນໄຟລ໌ໃໝ່ (ບໍ່ມີຂໍ້ມູນຊ້ຳ)
if rows:
    fieldnames = list(rows[0].keys())
    with open(output_file, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    
    print(f"✅ ສຳເລັດ! ລຶບຂໍ້ມູນຊ້ຳອອກແລ້ວ")
    print(f"   ຂໍ້ມູນເກົ່າ: {len(rows) + len(seen_order_ids) - len(rows)} rows")
    print(f"   ຂໍ້ມູນໃໝ່: {len(rows)} rows")
    print(f"   ຂໍ້ມູນຊ້ຳທີ່ຖືກລຶບ: {len(seen_order_ids) - len(rows)} rows")
    print(f"\n📁 ໄຟລ໌ໃໝ່: {output_file}")
    print(f"\n📝 ໃຊ້ໄຟລ໌ນີ້ສຳລັບ Import: lis_test_orders_no_duplicates.csv")
else:
    print("❌ ບໍ່ມີຂໍ້ມູນໃນ CSV!")
