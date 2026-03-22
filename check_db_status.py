"""Check all Supabase table counts"""
import requests
import os
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
SUPABASE_KEY = os.getenv("VITE_SUPABASE_ANON_KEY")

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}"
}

tables = [
    'users', 'settings', 'test_master', 'test_parameters',
    'test_reagent_mapping', 'stock_master', 'inventory_lots',
    'stock_transactions', 'test_orders', 'test_results',
    'maintenance_log', 'audit_log'
]

print("="*60)
print("📊 SUPABASE DATABASE STATUS")
print("="*60)

for table in tables:
    url = f"{SUPABASE_URL}/rest/v1/{table}?select=count"
    try:
        response = requests.get(url, headers=HEADERS)
        result = response.json()
        count = result[0]['count'] if result else 0
        print(f"✅ {table}: {count:,} records")
    except Exception as e:
        print(f"❌ {table}: Error - {str(e)[:50]}")

print("="*60)
