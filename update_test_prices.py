"""
Update test_master prices from Excel
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
    print("📖 Reading Test_Master from Excel...")
    df = pd.read_excel(EXCEL_PATH, "Test_Master")
    print(f"✅ Loaded {len(df)} records")
    
    # Get existing test_master from Supabase
    url = f"{SUPABASE_URL}/rest/v1/test_master?select=*"
    response = requests.get(url, headers=HEADERS)
    existing = response.json()
    print(f"📊 Existing test_master: {len(existing)} records")
    
    # Create name to id mapping
    name_to_id = {t['name'].strip().lower(): t['id'] for t in existing}
    
    updated = 0
    for idx, row in df.iterrows():
        test_name = str(row['Test_Name']).strip()
        price = float(row['Price']) if pd.notna(row.get('Price')) else 0
        
        test_id = name_to_id.get(test_name.lower())
        if test_id:
            # Update price
            update_url = f"{SUPABASE_URL}/rest/v1/test_master?id=eq.{test_id}"
            update_data = {"price": price}
            update_resp = requests.patch(update_url, json=update_data, headers=HEADERS)
            if update_resp.status_code in (200, 201):
                updated += 1
                if updated <= 5:
                    print(f"  ✓ Updated {test_name}: {price}")
    
    print(f"\n✨ Updated {updated} records with prices")

if __name__ == "__main__":
    main()
