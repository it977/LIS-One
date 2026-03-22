"""
Populate other Supabase tables from Excel data
- settings (VisitType, Insite, Doctor, Department, Sender, LabDest)
- test_master (ລາຍການກວດ)
- users (from sender data)
"""
import pandas as pd
import requests
import os
import math
from datetime import datetime
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

def get_existing_records(table_name):
    """Get existing records from a table to avoid duplicates"""
    url = f"{SUPABASE_URL}/rest/v1/{table_name}"
    try:
        response = requests.get(url, headers=HEADERS)
        response.raise_for_status()
        return response.json()
    except:
        return []

def insert_records(table_name, data):
    """Insert records into table"""
    url = f"{SUPABASE_URL}/rest/v1/{table_name}"
    try:
        response = requests.post(url, json=data, headers=HEADERS)
        if response.status_code == 409:
            return 0, "duplicates"
        response.raise_for_status()
        return len(response.json()) if response.json() else len(data), "success"
    except requests.exceptions.HTTPError as e:
        return 0, str(e)

def populate_settings(df):
    """Populate settings table from Excel data"""
    print("\n" + "="*50)
    print("📋 POPULATING SETTINGS TABLE")
    print("="*50)
    
    settings_data = []
    
    # VisitType
    visit_types = df['Visit_Type'].dropna().unique()
    for vt in visit_types:
        vt = safe_str(vt)
        if vt:
            settings_data.append({"type": "VisitType", "value": vt})
    
    # Insite
    insites = df['Insite'].dropna().unique()
    for ins in insites:
        ins = safe_str(ins)
        if ins:
            settings_data.append({"type": "Insite", "value": ins})
    
    # Doctor
    doctors = df['Doctor'].dropna().unique()
    for doc in doctors:
        doc = safe_str(doc)
        if doc:
            settings_data.append({"type": "Doctor", "value": doc})
    
    # Department
    depts = df['Department'].dropna().unique()
    for dept in depts:
        dept = safe_str(dept)
        if dept:
            settings_data.append({"type": "Department", "value": dept})
    
    # Sender
    senders = df['Sender'].dropna().unique()
    for sender in senders:
        sender = safe_str(sender)
        if sender:
            settings_data.append({"type": "Sender", "value": sender})
    
    # LabDest
    lab_dests = df['Lab_Destination'].dropna().unique()
    for ld in lab_dests:
        ld_val = safe_str(ld)
        if ld_val:
            try:
                ld_int = int(float(ld_val))
                mapping = {1: "In-house", 2: "ຫ້ອງທົດລອງ 1", 3: "ຫ້ອງທົດລອງ 2"}
                ld_val = mapping.get(ld_int, ld_val)
            except:
                pass
            settings_data.append({"type": "LabDest", "value": ld_val})
    
    # Remove duplicates
    seen = set()
    unique_settings = []
    for s in settings_data:
        key = (s["type"], s["value"])
        if key not in seen:
            seen.add(key)
            unique_settings.append(s)
    
    print(f"📦 Prepared {len(unique_settings)} settings records")
    
    # Check existing
    existing = get_existing_records("settings")
    existing_set = {(s["type"], s["value"]) for s in existing}
    
    to_insert = [s for s in unique_settings if (s["type"], s["value"]) not in existing_set]
    print(f"   - {len(to_insert)} new records to insert")
    print(f"   - {len(unique_settings) - len(to_insert)} already exist")
    
    if to_insert:
        count, status = insert_records("settings", to_insert)
        if status == "success":
            print(f"✅ Inserted {count} settings")
        else:
            print(f"⚠️  Some may be duplicates")
    
    # Print summary
    print("\n📊 Settings Summary:")
    type_counts = {}
    for s in unique_settings:
        type_counts[s["type"]] = type_counts.get(s["type"], 0) + 1
    for t, c in type_counts.items():
        print(f"   - {t}: {c} items")

def populate_test_master(df):
    """Populate test_master table from Test_Items"""
    print("\n" + "="*50)
    print("🧪 POPULATING TEST_MASTER TABLE")
    print("="*50)
    
    test_master_data = []
    
    # Parse all test items
    all_tests = set()
    for items in df['Test_Items'].dropna():
        if isinstance(items, str):
            # Split by comma
            for test in items.split(','):
                test = safe_str(test)
                if test:
                    all_tests.add(test)
    
    # Get prices from data (use first occurrence)
    test_prices = {}
    test_categories = {}
    for _, row in df.iterrows():
        items = safe_str(row.get('Test_Items', ''))
        if items:
            for test in items.split(','):
                test = safe_str(test)
                if test and test not in test_prices:
                    test_prices[test] = float(row.get('Total_Price', 0)) if not is_nan(row.get('Total_Price')) else 0
                    test_categories[test] = safe_str(row.get('Category', ''))
    
    for test_name in sorted(all_tests):
        test_master_data.append({
            "name": test_name,
            "category": test_categories.get(test_name, ''),
            "price": test_prices.get(test_name, 0)
        })
    
    print(f"📦 Prepared {len(test_master_data)} test master records")
    
    # Check existing
    existing = get_existing_records("test_master")
    existing_names = {s["name"].lower() for s in existing}
    
    to_insert = [t for t in test_master_data if t["name"].lower() not in existing_names]
    print(f"   - {len(to_insert)} new records to insert")
    print(f"   - {len(test_master_data) - len(to_insert)} already exist")
    
    if to_insert:
        count, status = insert_records("test_master", to_insert)
        if status == "success":
            print(f"✅ Inserted {count} test master records")
        else:
            print(f"⚠️  Status: {status}")
    
    # Print sample
    print(f"\n📋 Sample tests: {[t['name'] for t in test_master_data[:10]]}")

def populate_users_from_senders(df):
    """Create user records from senders"""
    print("\n" + "="*50)
    print("👤 POPULATING USERS TABLE (from senders)")
    print("="*50)
    
    senders = df['Sender'].dropna().unique()
    users_data = []
    
    for i, sender in enumerate(senders):
        sender = safe_str(sender)
        if sender:
            username = sender.lower().replace(' ', '_').replace('.', '')
            users_data.append({
                "username": username,
                "password": "password123",  # Default password
                "role": "User"
            })
    
    # Add default admin if not exists
    users_data.insert(0, {
        "username": "admin",
        "password": "admin1234",
        "role": "Admin"
    })
    
    print(f"📦 Prepared {len(users_data)} user records")
    
    # Check existing
    existing = get_existing_records("users")
    existing_usernames = {s["username"].lower() for s in existing}
    
    to_insert = [u for u in users_data if u["username"].lower() not in existing_usernames]
    print(f"   - {len(to_insert)} new records to insert")
    print(f"   - {len(users_data) - len(to_insert)} already exist")
    
    if to_insert:
        count, status = insert_records("users", to_insert)
        if status == "success":
            print(f"✅ Inserted {count} users")
        else:
            print(f"⚠️  Status: {status}")
    
    print(f"\n📋 Default credentials:")
    print(f"   - admin / admin1234")
    print(f"   - Other users: username / password123")

def main():
    print("🚀 POPULATING SUPABASE TABLES")
    print("="*50)
    
    print("📖 Reading Excel file...")
    df = pd.read_excel(EXCEL_PATH)
    print(f"✅ Loaded {len(df)} rows")
    
    # Populate tables
    populate_settings(df)
    populate_test_master(df)
    populate_users_from_senders(df)
    
    print("\n" + "="*50)
    print("✨ ALL TABLES POPULATED!")
    print("="*50)
    print("\n📊 Summary of tables:")
    print("   - settings: VisitType, Insite, Doctor, Department, Sender, LabDest")
    print("   - test_master: List of all test items with prices")
    print("   - users: Default admin + users from senders")
    print("   - test_orders: Already uploaded (333 records)")

if __name__ == "__main__":
    main()
