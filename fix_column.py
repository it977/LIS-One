import re

# Read the file
with open(r'C:\Users\Advice_WW\OneDrive\Documents\GitHub\LIS-One-master\src\api.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the column name
content = content.replace("Date_Of_Birth", "Date_of_Birth")

# Write back
with open(r'C:\Users\Advice_WW\OneDrive\Documents\GitHub\LIS-One-master\src\api.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed! Date_Of_Birth -> Date_of_Birth")
