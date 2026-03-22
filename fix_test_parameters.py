"""
Fix and upload test_parameters table
"""
import pandas as pd
import requests
import os
import json
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
    if isinstance(value, str) and value.lower() in ('nan', 'nat', ''):
        return True
    return False

def safe_str(value, default=""):
    if is_nan(value):
        return default
    return str(value).strip()

def safe_float(value):
    if is_nan(value):
        return None
    try:
        return float(value)
    except:
        return None

def main():
    print("🔧 Fixing test_parameters upload...")
    
    df = pd.read_excel(EXCEL_PATH, "Test_Parameters")
    print(f"📖 Loaded {len(df)} test parameters")
    
    # Transform data
    data = []
    for idx, row in df.iterrows():
        record = {
            "test_name": safe_str(row.get("Test_Name")),
            "param_name": safe_str(row.get("Parameter_Name")),
            "input_type": safe_str(row.get("Input_Type"), "number"),
            "unit": safe_str(row.get("Unit")),
            "normal_min": safe_float(row.get("Normal_Min")),
            "normal_max": safe_float(row.get("Normal_Max"))
        }
        # Only include options if not empty
        options = safe_str(row.get("Options"))
        if options and options.lower() not in ('nan', ''):
            record["options"] = options
        
        data.append(record)
    
    print(f"\n📋 Sample record:")
    print(json.dumps(data[0], indent=2))
    
    # Try uploading single record first
    print("\n🧪 Testing single record upload...")
    url = f"{SUPABASE_URL}/rest/v1/test_parameters"
    
    response = requests.post(url, json=data[0:1], headers=HEADERS)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text[:500]}")
    
    if response.status_code in (200, 201):
        print("\n✅ Single record works! Uploading all...")
        # Upload in batches
        batch_size = 50
        total = 0
        for i in range(0, len(data), batch_size):
            batch = data[i:i+batch_size]
            response = requests.post(url, json=batch, headers=HEADERS)
            if response.status_code in (200, 201):
                result = response.json()
                total += len(result) if result else len(batch)
                print(f"  Batch {i//batch_size + 1}: {len(batch)} records")
            elif response.status_code == 409:
                print(f"  Batch {i//batch_size + 1}: Skipped (duplicates)")
            else:
                print(f"  Batch {i//batch_size + 1}: Error - {response.text[:200]}")
        
        print(f"\n✅ Uploaded {total} test parameters")
    else:
        print(f"\n❌ Error: {response.text}")

if __name__ == "__main__":
    main()
