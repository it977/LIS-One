#!/usr/bin/env python3
"""
Fix inventory_lots - ແກ້ໄຂ reagent_id ທີ່ເປັນ 0
"""

import csv
from pathlib import Path

CSV_FOLDER = r"C:\Users\Advice_WW\Downloads"

# ອ່ານໄຟລ໌ເກົ່າ
input_path = Path(CSV_FOLDER) / "lis_inventory_lots_fixed.csv"
output_path = Path(CSV_FOLDER) / "lis_inventory_lots_fixed2.csv"

with open(input_path, 'r', encoding='utf-8') as f_in:
    reader = csv.DictReader(f_in)
    rows = list(reader)

# ແກ້ໄຂ reagent_id ທີ່ເປັນ 0 ໃຫ້ເປັນ NULL
fixed_count = 0
for row in rows:
    if row.get('reagent_id') == '0' or row.get('reagent_id') == '':
        row['reagent_id'] = None
        fixed_count += 1

# ຂຽນໄຟລ໌ໃໝ່
columns = ['lot_id', 'reagent_id', 'reagent_name', 'lot_no', 'supplier', 'location', 'receive_date', 'exp_date', 'qty', 'qty_remaining', 'created_at']

with open(output_path, 'w', encoding='utf-8', newline='') as f_out:
    writer = csv.DictWriter(f_out, fieldnames=columns, extrasaction='ignore')
    writer.writeheader()
    writer.writerows(rows)

print(f"✅ ແກ້ໄຂ {fixed_count}/{len(rows)} rows")
print(f"📁 ໄຟລ໌ໃໝ່: {output_path}")
print("\n📝 ໃຊ້ໄຟລ໌ lis_inventory_lots_fixed2.csv ສຳລັບ import ຄັ້ງຕໍ່ໄປ")
