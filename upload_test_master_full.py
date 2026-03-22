"""
Upload ALL Test_Master records from Excel to Supabase
"""
import pandas as pd
import requests
import os
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
SUPABASE_KEY = os.getenv("VITE_SUPABASE_ANON_KEY")
EXCEL_PATH = r"C:\Users\KVL COMPUTER\Downloads\LIS_Database.xlsx"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

def main():
    print("="*60)
    print("📊 UPLOAD TEST_MASTER FROM EXCEL TO SUPABASE")
    print("="*60)
    
    # Read Excel
    print("\n📖 Reading Test_Master from Excel...")
    df = pd.read_excel(EXCEL_PATH, "Test_Master")
    print(f"✅ Excel has {len(df)} records")
    
    # Get existing from Supabase
    print("\n📊 Getting existing records from Supabase...")
    url = f"{SUPABASE_URL}/rest/v1/test_master?select=*"
    response = requests.get(url, headers=HEADERS)
    existing = response.json()
    print(f"✅ Database has {len(existing)} records")
    
    # Create name mapping (case-insensitive)
    existing_names = {t['name'].strip().lower() for t in existing}
    
    # Prepare new records
    to_insert = []
    for idx, row in df.iterrows():
        test_name = str(row['Test_Name']).strip()
        price = float(row['Price']) if pd.notna(row.get('Price')) else 0
        category = str(row['Category']).strip() if pd.notna(row.get('Category')) else 'Other'
        
        if test_name.lower() not in existing_names:
            to_insert.append({
                "name": test_name,
                "price": price,
                "category": category
            })
            existing_names.add(test_name.lower())
    
    print(f"\n📦 Need to insert {len(to_insert)} new records")
    
    if not to_insert:
        print("✅ All records already exist!")
        return
    
    # Insert in batches
    print("\n🚀 Uploading to Supabase...")
    insert_url = f"{SUPABASE_URL}/rest/v1/test_master"
    
    batch_size = 50
    total_inserted = 0
    
    for i in range(0, len(to_insert), batch_size):
        batch = to_insert[i:i+batch_size]
        response = requests.post(insert_url, json=batch, headers=HEADERS)
        
        if response.status_code in (200, 201):
            result = response.json()
            total_inserted += len(result) if result else len(batch)
            print(f"  ✓ Batch {i//batch_size + 1}: {len(batch)} records")
        else:
            print(f"  ❌ Batch {i//batch_size + 1}: Error - {response.text[:200]}")
    
    print(f"\n✨ Complete! Inserted {total_inserted} new records")
    print(f"📊 Total test_master records: {len(existing) + total_inserted}")

if __name__ == "__main__":
    main()
