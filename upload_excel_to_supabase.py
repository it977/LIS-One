"""
Upload LIS Database Excel to Supabase using REST API
"""
import pandas as pd
import requests
import os
import math
import json
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
SUPABASE_KEY = os.getenv("VITE_SUPABASE_ANON_KEY")

EXCEL_PATH = r"C:\Users\KVL COMPUTER\Downloads\LIS_Database.xlsx"

# Headers for Supabase REST API
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

def is_nan(value):
    """Check if value is NaN, NaT, None or empty"""
    if value is None:
        return True
    # Use pandas isna for comprehensive NaN/NaT detection
    if pd.isna(value):
        return True
    if isinstance(value, str) and value.lower() in ('nan', 'nat', ''):
        return True
    return False

def safe_str(value, default=""):
    """Safely convert to string, handling NaN"""
    if is_nan(value):
        return default
    return str(value)

def parse_lab_destination(value):
    """Convert numeric Lab_Destination to text"""
    if is_nan(value):
        return "In-house"
    try:
        mapping = {
            1: "In-house",
            2: "ຫ້ອງທົດລອງ 1",
            3: "ຫ້ອງທົດລອງ 2",
        }
        return mapping.get(int(value), "In-house")
    except (ValueError, TypeError):
        return str(value) if value else "In-house"

def parse_datetime(value):
    """Convert datetime to ISO format string"""
    if is_nan(value):
        return datetime.now().isoformat()
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)

def parse_received_date(value):
    """Convert received date to ISO format string or None"""
    if is_nan(value):
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    str_val = str(value)
    if str_val.lower() in ('nat', 'nan', 'none', ''):
        return None
    return str_val

def parse_age(value):
    """Convert age to string"""
    if is_nan(value):
        return ""
    try:
        return str(int(value)) if value == int(value) else str(value)
    except (ValueError, TypeError):
        return str(value)

def upload_to_supabase(table_name, data):
    """Upload data to Supabase table using REST API"""
    url = f"{SUPABASE_URL}/rest/v1/{table_name}"
    response = None
    
    try:
        response = requests.post(url, json=data, headers=HEADERS)
        response.raise_for_status()
        return len(response.json()) if response.json() else len(data), None
    except requests.exceptions.HTTPError as e:
        error_msg = str(e)
        if response is not None:
            try:
                error_detail = response.text
            except:
                error_detail = error_msg
        else:
            error_detail = error_msg
        return 0, error_detail

def upload_data():
    """Main upload function"""
    print("📖 Reading Excel file...")
    df = pd.read_excel(EXCEL_PATH)
    
    print(f"✅ Loaded {len(df)} rows from Excel")
    print(f"📋 Columns: {df.columns.tolist()}")
    
    # Process data for upload
    orders_to_insert = []
    
    for idx, row in df.iterrows():
        order_data = {
            "order_id": safe_str(row["Order_ID"]),
            "order_datetime": parse_datetime(row["Order_DateTime"]),
            "time_slot": safe_str(row.get("Time_Slot")),
            "visit_type": safe_str(row.get("Visit_Type")),
            "insite": safe_str(row.get("Insite")),
            "patient_id": safe_str(row.get("Patient_ID")),
            "patient_name": safe_str(row.get("Patient_Name")),
            "age": parse_age(row.get("Age")),
            "gender": safe_str(row.get("Gender")),
            "doctor": safe_str(row.get("Doctor")),
            "department": safe_str(row.get("Department")),
            "test_type": safe_str(row.get("Test_Type"), "Normal"),
            "test_name": safe_str(row.get("Test_Items")),
            "price": float(row.get("Total_Price", 0)) if not is_nan(row.get("Total_Price")) else 0.0,
            "total_price": float(row.get("Total_Order_Price", 0)) if not is_nan(row.get("Total_Order_Price")) else 0.0,
            "lab_dest": parse_lab_destination(row.get("Lab_Destination")),
            "sender": safe_str(row.get("Sender")),
            "status": safe_str(row.get("Status"), "Pending"),
            "category": safe_str(row.get("Category")),
            "completed_at": parse_received_date(row.get("Received_Date")),
            "note": safe_str(row.get("Note")) if not is_nan(row.get("Note")) else None,
        }
        orders_to_insert.append(order_data)
    
    print(f"\n📦 Prepared {len(orders_to_insert)} order records")
    
    # Show first record for debugging
    print(f"\n📋 Sample record:")
    print(json.dumps(orders_to_insert[0], indent=2, default=str))
    
    # Insert test orders in batches
    print("\n🚀 Uploading test orders to Supabase...")
    batch_size = 50
    total_inserted = 0
    total_skipped = 0
    total_errors = 0
    
    for i in range(0, len(orders_to_insert), batch_size):
        batch = orders_to_insert[i:i + batch_size]
        count, error = upload_to_supabase("test_orders", batch)
        
        if error:
            if "duplicate" in error.lower() or "409" in error:
                total_skipped += len(batch)
                print(f"  ⚠️  Batch {i//batch_size + 1}: {len(batch)} records skipped (duplicates)")
            else:
                total_errors += len(batch)
                print(f"  ❌ Batch {i//batch_size + 1}: Error - {error[:200]}")
        else:
            total_inserted += count
            print(f"  ✓ Batch {i//batch_size + 1}: {count} records inserted")
    
    print(f"\n✨ Upload complete!")
    print(f"   Total inserted: {total_inserted}")
    print(f"   Total skipped: {total_skipped}")
    if total_errors > 0:
        print(f"   Total errors: {total_errors}")
    
    # Summary
    print("\n📊 Summary:")
    print(f"   - Test Orders: {total_inserted} new records uploaded")
    if total_skipped > 0:
        print(f"   - Skipped: {total_skipped} duplicate records")

if __name__ == "__main__":
    upload_data()
