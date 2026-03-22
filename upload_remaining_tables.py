"""
Upload stock_master and test_reagent_mapping
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

def is_nan(value):
    if value is None:
        return True
    if pd.isna(value):
        return True
    return False

def safe_str(value, default=""):
    if is_nan(value):
        return default
    return str(value).strip()

def safe_float(value, default=0.0):
    if is_nan(value):
        return default
    try:
        return float(value)
    except:
        return default

def upload_table(table_name, data):
    url = f"{SUPABASE_URL}/rest/v1/{table_name}"
    try:
        response = requests.post(url, json=data, headers=HEADERS)
        if response.status_code in (200, 201):
            result = response.json()
            return len(result) if result else len(data), "success"
        elif response.status_code == 409:
            return 0, "duplicates"
        else:
            return 0, response.text[:200]
    except Exception as e:
        return 0, str(e)

def main():
    xl = pd.ExcelFile(EXCEL_PATH)
    
    # ========== STOCK MASTER ==========
    print("="*60)
    print("📦 UPLOAD STOCK_MASTER")
    print("="*60)
    
    df = pd.read_excel(xl, "Stock_Master")
    data = []
    for idx, row in df.iterrows():
        data.append({
            "name": safe_str(row.get("Reagent_Name")),
            "unit": safe_str(row.get("Unit"))
        })
    
    # Remove duplicates
    seen = set()
    unique_data = []
    for d in data:
        key = d["name"].lower()
        if key not in seen:
            seen.add(key)
            unique_data.append(d)
    
    print(f"📦 Prepared {len(unique_data)} unique stock master records")
    
    count, status = upload_table("stock_master", unique_data)
    if status == "success":
        print(f"✅ Inserted {count} records")
    elif status == "duplicates":
        print(f"⚠️  Already exists")
    else:
        print(f"❌ Error: {status}")
    
    # ========== TEST REAGENT MAPPING ==========
    print("\n" + "="*60)
    print("🧪 UPLOAD TEST_REAGENT_MAPPING")
    print("="*60)
    
    # Check if sheet exists
    if "Test_Reagent_Mapping" in xl.sheet_names:
        df = pd.read_excel(xl, "Test_Reagent_Mapping")
        print(f"📖 Found {len(df)} records in Excel")
        
        data = []
        for idx, row in df.iterrows():
            data.append({
                "test_name": safe_str(row.get("Test_Name")),
                "reagent_id": int(row.get("Reagent_ID", 0)),
                "reagent_name": safe_str(row.get("Reagent_Name")),
                "qty": safe_float(row.get("Qty"))
            })
        
        count, status = upload_table("test_reagent_mapping", data)
        if status == "success":
            print(f"✅ Inserted {count} records")
        elif status == "duplicates":
            print(f"⚠️  Already exists")
        else:
            print(f"❌ Error: {status}")
    else:
        print("ℹ️  Test_Reagent_Mapping sheet not found in Excel")
        print("   This table can be populated later when reagent data is available")
    
    print("\n" + "="*60)
    print("✅ DONE!")
    print("="*60)

if __name__ == "__main__":
    main()
