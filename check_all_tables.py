"""
Check all tables - Compare Excel vs Supabase
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

# Mapping Excel sheets to Supabase tables
TABLE_MAPPING = {
    "Test_Orders": "test_orders",
    "Test_Parameters": "test_parameters",
    "Test_Results": "test_results",
    "Inventory_Lots": "inventory_lots",
    "Maintenance_Log": "maintenance_log",
    "Stock_Master": "stock_master",
    "Stock_Transactions": "stock_transactions",
    "Settings": "settings",
    "Users": "users",
    "Test_Master": "test_master",
    "Audit_Log": "audit_log"
}

def get_supabase_count(table_name):
    """Get record count from Supabase"""
    url = f"{SUPABASE_URL}/rest/v1/{table_name}?select=count"
    try:
        response = requests.get(url, headers=HEADERS)
        if response.status_code == 200:
            result = response.json()
            return result[0]['count'] if result else 0
    except:
        pass
    return 0

def main():
    print("="*70)
    print("📊 CHECK ALL TABLES - EXCEL vs SUPABASE")
    print("="*70)
    
    # Load Excel
    xl = pd.ExcelFile(EXCEL_PATH)
    excel_sheets = xl.sheet_names
    
    results = []
    
    print(f"\n📖 Excel has {len(excel_sheets)} sheets")
    print(f"📊 Checking Supabase tables...\n")
    
    for sheet_name, table_name in TABLE_MAPPING.items():
        # Excel count
        if sheet_name in excel_sheets:
            df = pd.read_excel(xl, sheet_name)
            excel_count = len(df)
        else:
            excel_count = 0
        
        # Supabase count
        db_count = get_supabase_count(table_name)
        
        # Status
        if excel_count == 0 and db_count > 0:
            status = "✅ DB only"
        elif db_count >= excel_count and excel_count > 0:
            status = "✅ OK"
        elif db_count < excel_count:
            status = f"❌ MISSING {excel_count - db_count}"
        else:
            status = "⚠️  Check"
        
        results.append({
            "Sheet": sheet_name,
            "Table": table_name,
            "Excel": excel_count,
            "Database": db_count,
            "Status": status
        })
        
        # Print row
        status_icon = "✅" if "OK" in status else ("❌" if "MISSING" in status else "⚠️")
        print(f"{status_icon} {sheet_name:25} → {table_name:25} | Excel: {excel_count:4} | DB: {db_count:4} | {status}")
    
    # Check for missing tables
    print("\n" + "="*70)
    print("📋 SUMMARY")
    print("="*70)
    
    ok_count = sum(1 for r in results if "OK" in r["Status"])
    missing_count = sum(1 for r in results if "MISSING" in r["Status"])
    
    print(f"\n✅ Complete: {ok_count} tables")
    print(f"❌ Missing data: {missing_count} tables")
    
    if missing_count > 0:
        print(f"\n🔧 Tables need upload:")
        for r in results:
            if "MISSING" in r["Status"]:
                print(f"   - {r['Sheet']} → {r['Table']} (Need: {r['Excel'] - r['Database']} more records)")
    
    print("\n" + "="*70)

if __name__ == "__main__":
    main()
