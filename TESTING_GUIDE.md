# Dashboard Fixes - Testing Guide

## Quick Start Testing

### 1. Start the Development Server

```bash
npm run dev
```

Then open your browser to the local development URL (usually http://localhost:5173)

---

## Test Scenario 1: PDF Export

### Steps:
1. Login to the system
2. Navigate to Dashboard page
3. Select a date range (or use "Today", "This Week", etc.)
4. Click the **"PDF"** button in the top-right corner
5. Wait for "Generating PDF..." message
6. PDF should download automatically

### Expected Results:
✅ PDF downloads with filename like `Dashboard-Report-2026-05-17.pdf`
✅ PDF opens without errors
✅ Header shows correct date range and generation time
✅ KPI cards display with "Kip" format (e.g., "Kip 3,280,000")
✅ All 4 charts are visible and clear:
   - Gender Distribution
   - OPD vs IPD
   - In-Lab vs Outsource
   - Age Groups
✅ Summary table shows all test data with proper formatting
✅ No corrupted symbols or garbled text
✅ Lao characters (if any) render correctly

### What to Check:
- [ ] Currency format is "Kip X,XXX,XXX" (not ₭ symbol)
- [ ] Charts are clear and readable
- [ ] Table data is complete
- [ ] No missing sections
- [ ] Page layout looks professional

---

## Test Scenario 2: Gender Chart

### Steps:
1. Open Dashboard
2. Open Browser Console (F12)
3. Look for console logs
4. Locate the Gender pie chart (top row, first chart)

### Expected Results:
✅ Chart displays with colored segments
✅ Shows "Male" and "Female" counts
✅ Percentages are visible on hover
✅ Console shows: `Gender data: { Male: X, Female: Y }`

### Troubleshooting:
If chart is blank:
1. Check console for "Gender data:" log
2. Verify your orders have gender field populated
3. Check if gender values are: "Male", "Female", "m", "f", etc.
4. If all orders have empty gender, chart will show "No Data"

### Sample Data Check:
```sql
-- Run this in your database to check gender values
SELECT gender, COUNT(*) 
FROM lis_one_orders 
GROUP BY gender;
```

---

## Test Scenario 3: Insite (OPD/IPD) Chart

### Steps:
1. Open Dashboard
2. Locate the "OPD vs IPD" pie chart (top row, second chart)
3. Check Browser Console for logs

### Expected Results:
✅ Chart displays with colored segments
✅ Shows "OPD" and "IPD" counts
✅ Console shows: `Insite data: { OPD: X, IPD: Y }`

### Troubleshooting:
If chart is blank:
1. Check console for "Insite data:" log
2. Verify your orders have insite field populated
3. Check if insite values contain: "OPD", "IPD", "OUT-PATIENT", "IN-PATIENT"
4. Values are case-insensitive

### Sample Data Check:
```sql
-- Run this in your database to check insite values
SELECT insite, COUNT(*) 
FROM lis_one_orders 
GROUP BY insite;
```

---

## Test Scenario 4: Test Categories

### Steps:
1. Open Dashboard
2. Scroll down to "5 ອັນດັບ ໝວດໝູ່ (Top Categories)" section
3. Check the categories listed
4. Scroll to "Summary Report Table" at the bottom
5. Expand the table (click "ສະແດງ" button)

### Expected Results:
✅ Top Categories shows real category names (NOT all "Other")
✅ Categories include:
   - Biochemistry
   - Hematology
   - Immunoserology
   - Stool/Urine
   - Cardiology
   - Hormone
   - Other (only for uncategorized tests)
✅ Summary table shows each test with its correct category
✅ Revenue is properly calculated per category

### Troubleshooting:
If all tests show "Other":
1. Check if `lis_one_test_master` table has category column populated
2. Verify test names in orders match test names in test_master
3. Check console for any errors during dashboard load

### Sample Data Check:
```sql
-- Check test master categories
SELECT name, category, price 
FROM lis_one_test_master 
LIMIT 10;

-- Check if test names match between tables
SELECT DISTINCT o.test_name, tm.category
FROM lis_one_orders o
LEFT JOIN lis_one_test_master tm ON o.test_name = tm.name
LIMIT 20;
```

---

## Test Scenario 5: Currency Formatting

### Steps:
1. Check Dashboard KPI cards (top of page)
2. Check all tables with revenue columns
3. Export PDF and check currency format

### Expected Results:
✅ **On Screen**: Currency shows as "₭ 3,280,000"
✅ **In PDF**: Currency shows as "Kip 3,280,000"
✅ Numbers have comma separators
✅ No negative values (all absolute)
✅ Proper alignment (right-aligned in tables)

---

## Browser Console Debugging

### What to Look For:

1. **When Dashboard Loads:**
```
Rendering Dashboard Charts with analytics: {Object}
Gender data: {Male: 5, Female: 3}
Insite data: {OPD: 6, IPD: 2}
```

2. **For Each Chart:**
```
Rendering pie chart chartGender with data: {Male: 5, Female: 3}
Chart chartGender entries: [["Male", 5], ["Female", 3]]
```

3. **If Data is Missing:**
```
No data for chart chartGender
No valid entries for chart chartGender
```

### Common Console Errors:

❌ **"Cannot read property 'map' of undefined"**
- Solution: Check if analytics object is properly populated

❌ **"Chart is not defined"**
- Solution: Verify Chart.js library is loaded

❌ **"html2pdf is not defined"**
- Solution: Check if html2pdf.js library is loaded in index.html

---

## Performance Testing

### PDF Generation Time:
- Small dataset (< 50 orders): 2-5 seconds
- Medium dataset (50-200 orders): 5-10 seconds
- Large dataset (> 200 orders): 10-20 seconds

### Dashboard Load Time:
- Should load within 2-3 seconds
- Charts should render immediately after data loads

---

## Edge Cases to Test

### 1. Empty Dashboard
- No orders in date range
- Should show "0" in KPI cards
- Charts should show "No Data"

### 2. Single Order
- Only 1 order in system
- Charts should still render
- Percentages should show 100%

### 3. Missing Data Fields
- Orders without gender
- Orders without insite
- Should show "Unknown" in charts

### 4. Special Characters
- Test names with special characters
- Lao language characters
- Should render correctly in PDF

### 5. Large Dataset
- 1000+ orders
- PDF should still generate
- May take longer (20-30 seconds)

---

## Rollback Plan

If issues occur, you can rollback:

1. **Restore Previous Version:**
```bash
git checkout HEAD~1 src/app.js
git checkout HEAD~1 index.html
```

2. **Or manually revert:**
- Remove html2pdf.js from index.html
- Restore old exportDashboardPDF function
- Restore old normalize functions

---

## Success Criteria

All fixes are working if:
- ✅ PDF exports successfully with readable content
- ✅ Gender chart shows data (not blank)
- ✅ Insite chart shows data (not blank)
- ✅ Categories are correct (not all "Other")
- ✅ Currency displays as "Kip X,XXX,XXX" in PDF
- ✅ No console errors
- ✅ Dashboard loads within 3 seconds

---

## Need Help?

1. Check `DASHBOARD_FIXES.md` for technical details
2. Review browser console for error messages
3. Verify database has proper data
4. Check network tab for API call failures
5. Try clearing browser cache and reloading

---

**Happy Testing! 🎉**
