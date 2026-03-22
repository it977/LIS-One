"""
Find missing Stock_Master record
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
}

def main():
    # Read Excel
    df = pd.read_excel(EXCEL_PATH, "Stock_Master")
    excel_names = {str(row['Reagent_Name']).strip().lower() for idx, row in df.iterrows()}
    print(f"Excel has {len(excel_names)} unique names")
    
    # Get Supabase
    url = f"{SUPABASE_URL}/rest/v1/stock_master?select=*"
    response = requests.get(url, headers=HEADERS)
    db_data = response.json()
    db_names = {t['name'].strip().lower() for t in db_data}
    print(f"Database has {len(db_names)} unique names")
    
    # Find missing
    missing = excel_names - db_names
    extra_in_db = db_names - excel_names
    
    if missing:
        print(f"\n❌ Missing in DB ({len(missing)}):")
        for name in missing:
            # Find full record
            for idx, row in df.iterrows():
                if str(row['Reagent_Name']).strip().lower() == name:
                    print(f"   - {row['Reagent_Name']} (Unit: {row.get('Unit', '')})")
                    break
    
    if extra_in_db:
        print(f"\n⚠️  Extra in DB ({len(extra_in_db)}):")
        for name in list(extra_in_db)[:10]:
            print(f"   - {name}")

if __name__ == "__main__":
    main()
