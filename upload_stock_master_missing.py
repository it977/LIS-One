"""
Upload missing Stock_Master records
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
    print("📦 UPLOAD MISSING STOCK_MASTER RECORDS")
    print("="*60)
    
    # Read Excel
    print("\n📖 Reading Stock_Master from Excel...")
    df = pd.read_excel(EXCEL_PATH, "Stock_Master")
    print(f"✅ Excel has {len(df)} records")
    
    # Get existing from Supabase
    print("\n📊 Getting existing records from Supabase...")
    url = f"{SUPABASE_URL}/rest/v1/stock_master?select=*"
    response = requests.get(url, headers=HEADERS)
    existing = response.json()
    print(f"✅ Database has {len(existing)} records")
    
    # Create name mapping
    existing_names = {t['name'].strip().lower() for t in existing}
    
    # Prepare new records
    to_insert = []
    for idx, row in df.iterrows():
        reagent_name = str(row['Reagent_Name']).strip()
        unit = str(row.get('Unit', '')).strip() if pd.notna(row.get('Unit')) else ''
        
        if reagent_name.lower() not in existing_names:
            to_insert.append({
                "name": reagent_name,
                "unit": unit
            })
            existing_names.add(reagent_name.lower())
            print(f"  + {reagent_name} ({unit})")
    
    print(f"\n📦 Need to insert {len(to_insert)} new records")
    
    if not to_insert:
        print("✅ All records already exist!")
        return
    
    # Insert
    print("\n🚀 Uploading to Supabase...")
    insert_url = f"{SUPABASE_URL}/rest/v1/stock_master"
    response = requests.post(insert_url, json=to_insert, headers=HEADERS)
    
    if response.status_code in (200, 201):
        result = response.json()
        print(f"✅ Successfully inserted {len(result) if result else len(to_insert)} records!")
    else:
        print(f"❌ Error: {response.text[:200]}")
    
    print("\n" + "="*60)

if __name__ == "__main__":
    main()
