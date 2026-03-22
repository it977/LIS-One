"""
Upload ALL sheets from LIS_Database.xlsx to Supabase
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

# Mapping from Excel sheet to Supabase table
SHEET_TABLE_MAPPING = {
    "Settings": "settings",
    "Users": "users",
    "Test_Master": "test_master",
    "Test_Parameters": "test_parameters",
    "Inventory_Lots": "inventory_lots",
    "Stock_Master": "stock_master",
    "Stock_Transactions": "stock_transactions",
    "Maintenance_Log": "maintenance_log",
    "Audit_Log": "audit_log",
    "Test_Results": "test_results"
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

def safe_int(value, default=0):
    if is_nan(value):
        return default
    try:
        return int(float(value))
    except:
        return default

def safe_float(value, default=0.0):
    if is_nan(value):
        return default
    try:
        return float(value)
    except:
        return default

def safe_date(value):
    if is_nan(value):
        return None
    if isinstance(value, datetime):
        return value.strftime('%Y-%m-%d')
    try:
        return pd.to_datetime(value).strftime('%Y-%m-%d')
    except:
        return None

def safe_datetime(value):
    if is_nan(value):
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    try:
        return pd.to_datetime(value).isoformat()
    except:
        return None

def transform_row(row, table_name):
    """Transform row data based on table type"""
    data = {}
    
    if table_name == "settings":
        data = {
            "type": safe_str(row.get("Type")),
            "value": safe_str(row.get("Value"))
        }
    
    elif table_name == "users":
        data = {
            "username": safe_str(row.get("Username")),
            "password": safe_str(row.get("Password")),
            "role": safe_str(row.get("Role"), "User")
        }
    
    elif table_name == "test_master":
        data = {
            "id": safe_int(row.get("Test_ID")) if not is_nan(row.get("Test_ID")) else None,
            "name": safe_str(row.get("Test_Name")),
            "price": safe_float(row.get("Price")),
            "category": safe_str(row.get("Category"))
        }
        # Remove id if None to let auto-increment handle it
        if data["id"] is None:
            del data["id"]
    
    elif table_name == "test_parameters":
        data = {
            "test_name": safe_str(row.get("Test_Name")),
            "param_name": safe_str(row.get("Parameter_Name")),
            "input_type": safe_str(row.get("Input_Type"), "number"),
            "options": safe_str(row.get("Options")),
            "unit": safe_str(row.get("Unit")),
            "normal_min": safe_float(row.get("Normal_Min")) if not is_nan(row.get("Normal_Min")) else None,
            "normal_max": safe_float(row.get("Normal_Max")) if not is_nan(row.get("Normal_Max")) else None
        }
    
    elif table_name == "inventory_lots":
        data = {
            "lot_id": safe_str(row.get("Lot_ID")),
            "reagent_id": safe_int(row.get("Reagent_ID")),
            "reagent_name": safe_str(row.get("Reagent_Name")),
            "lot_no": safe_str(row.get("Lot_Number")),
            "supplier": safe_str(row.get("Supplier")),
            "location": safe_str(row.get("Storage_Location")),
            "receive_date": safe_date(row.get("Receive_Date")),
            "exp_date": safe_date(row.get("Exp_Date")),
            "qty": safe_float(row.get("Initial_Qty")),
            "qty_remaining": safe_float(row.get("Current_Qty"))
        }
    
    elif table_name == "stock_master":
        data = {
            "id": safe_int(row.get("Reagent_ID")) if not is_nan(row.get("Reagent_ID")) else None,
            "name": safe_str(row.get("Reagent_Name")),
            "unit": safe_str(row.get("Unit")),
        }
        if data["id"] is None:
            del data["id"]
    
    elif table_name == "stock_transactions":
        data = {
            "reagent_id": safe_int(row.get("Reagent_ID")),
            "reagent_name": safe_str(row.get("Reagent_Name")),
            "type": safe_str(row.get("Type")),
            "qty": safe_float(row.get("Qty")),
            "note": safe_str(row.get("Note")),
            "user_name": safe_str(row.get("User")),
            "created_at": safe_datetime(row.get("Timestamp"))
        }
    
    elif table_name == "maintenance_log":
        data = {
            "log_id": safe_str(row.get("Log_ID")),
            "log_date": safe_date(row.get("Date")),
            "machine": safe_str(row.get("Machine_Name")),
            "type": safe_str(row.get("Maint_Type")),
            "issues": safe_str(row.get("Issues")),
            "action": safe_str(row.get("Action_Taken")),
            "next_due": safe_date(row.get("Next_Due_Date")),
            "user_name": safe_str(row.get("User"))
        }
    
    elif table_name == "audit_log":
        data = {
            "user_name": safe_str(row.get("User")),
            "action": safe_str(row.get("Action")),
            "target": safe_str(row.get("Target")),
            "details": safe_str(row.get("Details")),
            "created_at": safe_datetime(row.get("Timestamp"))
        }
    
    elif table_name == "test_results":
        data = {
            "order_id": safe_str(row.get("Order_ID")),
            "test_name": safe_str(row.get("Test_Name")),
            "param_name": safe_str(row.get("Parameter_Name")),
            "result_value": safe_str(row.get("Result_Value")),
            "flag": safe_str(row.get("Flag"), "Normal"),
            "user_name": safe_str(row.get("User")),
            "created_at": safe_datetime(row.get("Timestamp"))
        }
    
    return data

def get_existing_count(table_name):
    """Get count of existing records"""
    url = f"{SUPABASE_URL}/rest/v1/{table_name}?select=count"
    try:
        response = requests.get(url, headers=HEADERS)
        if response.status_code == 200:
            # Supabase returns Content-Range header with count
            content_range = response.headers.get('Content-Range', '')
            if '/' in content_range:
                return int(content_range.split('/')[-1])
        return 0
    except:
        return 0

def upload_table(table_name, data, batch_size=100):
    """Upload data to table in batches"""
    url = f"{SUPABASE_URL}/rest/v1/{table_name}"
    total_inserted = 0
    total_skipped = 0
    
    for i in range(0, len(data), batch_size):
        batch = data[i:i + batch_size]
        try:
            response = requests.post(url, json=batch, headers=HEADERS)
            if response.status_code == 409:
                # Conflict - some records exist
                total_skipped += len(batch)
            elif response.status_code in (200, 201):
                result = response.json()
                total_inserted += len(result) if result else len(batch)
            else:
                response.raise_for_status()
        except requests.exceptions.HTTPError as e:
            error_text = response.text if 'response' in dir() else str(e)
            if "duplicate" in error_text.lower():
                total_skipped += len(batch)
            else:
                print(f"    ❌ Batch {i//batch_size + 1}: {str(e)[:100]}")
    
    return total_inserted, total_skipped

def process_sheet(sheet_name, table_name, df):
    """Process a single sheet"""
    print(f"\n{'='*60}")
    print(f"📊 {sheet_name} → {table_name}")
    print(f"{'='*60}")
    
    # Transform all rows
    transformed_data = []
    for idx, row in df.iterrows():
        data = transform_row(row, table_name)
        # Remove None values for optional fields
        data = {k: v for k, v in data.items() if v is not None or k in ['qty', 'qty_remaining', 'price']}
        transformed_data.append(data)
    
    print(f"📦 Prepared {len(transformed_data)} records")
    
    # Check existing
    existing_count = get_existing_count(table_name)
    print(f"   - Existing records: {existing_count}")
    
    # Upload
    if transformed_data:
        print(f"🚀 Uploading...")
        inserted, skipped = upload_table(table_name, transformed_data)
        print(f"   ✅ Inserted: {inserted}")
        if skipped > 0:
            print(f"   ⚠️  Skipped (duplicates): {skipped}")
        return inserted, skipped
    
    return 0, 0

def main():
    print("="*60)
    print("🚀 UPLOAD ALL EXCEL DATA TO SUPABASE")
    print("="*60)
    
    # Load all sheets
    xl = pd.ExcelFile(EXCEL_PATH)
    print(f"📖 Loaded Excel with {len(xl.sheet_names)} sheets")
    
    total_all_inserted = 0
    total_all_skipped = 0
    
    # Process each sheet (skip Test_Orders - already uploaded)
    for sheet_name in xl.sheet_names:
        if sheet_name == "Test_Orders":
            print(f"\n⏭️  Skipping {sheet_name} (already uploaded)")
            continue
        
        if sheet_name in SHEET_TABLE_MAPPING:
            table_name = SHEET_TABLE_MAPPING[sheet_name]
            df = pd.read_excel(xl, sheet_name)
            inserted, skipped = process_sheet(sheet_name, table_name, df)
            total_all_inserted += inserted
            total_all_skipped += skipped
    
    # Summary
    print("\n" + "="*60)
    print("✨ UPLOAD COMPLETE!")
    print("="*60)
    print(f"\n📊 Summary:")
    print(f"   Total inserted: {total_all_inserted}")
    print(f"   Total skipped: {total_all_skipped}")
    
    print(f"\n📋 Tables updated:")
    for sheet, table in SHEET_TABLE_MAPPING.items():
        if sheet != "Test_Orders":
            print(f"   - {table} (from {sheet})")
    
    print(f"\n✅ test_orders (uploaded earlier: 333 records)")

if __name__ == "__main__":
    main()
