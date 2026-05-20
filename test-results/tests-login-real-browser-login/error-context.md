# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests\login.spec.js >> real browser login
- Location: tests\login.spec.js:3:1

# Error details

```
Error: expect(locator).not.toBeVisible() failed

Locator:  locator('#loginScreen')
Expected: not visible
Received: visible
Timeout:  10000ms

Call log:
  - Expect "not toBeVisible" with timeout 10000ms
  - waiting for locator('#loginScreen')
    23 × locator resolved to <div id="loginScreen">…</div>
       - unexpected value "visible"

```

```yaml
- heading " LIS Test By No V2" [level=2]
- paragraph: Laboratory Information System
- textbox "Username": admin
- textbox "Password": admin1234
- text: Too many login attempts. Retry in 255s
- button " ເຂົ້າສູ່ລະບົບ (Login)"
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test('real browser login', async ({ page }) => {
  4  |   // Capture all console logs from the browser
  5  |   page.on('console', msg => console.log(`[BROWSER] ${msg.text()}`));
  6  |   page.on('pageerror', err => console.log(`[JS ERROR] ${err.message}`));
  7  | 
  8  |   console.log('Navigating to http://127.0.0.1:3000');
  9  |   await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle' });
  10 | 
  11 |   console.log('Filling login form...');
  12 |   await page.fill('#loginUser', 'admin');
  13 |   await page.fill('#loginPass', 'admin1234');
  14 | 
  15 |   console.log('Clicking login...');
  16 |   await page.click('#btnLogin');
  17 | 
  18 |   console.log('Waiting for login screen to hide...');
  19 |   // Our immediate hide logic uses display:none
> 20 |   await expect(page.locator('#loginScreen')).not.toBeVisible({ timeout: 10000 });
     |                                                  ^ Error: expect(locator).not.toBeVisible() failed
  21 | 
  22 |   console.log('Waiting for dashboard active...');
  23 |   const dashboard = page.locator('#dashboard');
  24 |   await expect(dashboard).toHaveClass(/active/, { timeout: 10000 });
  25 |   await expect(dashboard).toBeVisible();
  26 | 
  27 |   console.log('Login successful! Capturing screenshot...');
  28 |   const resultsDir = 'test-results';
  29 |   const fs = await import('fs');
  30 |   if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir);
  31 |   
  32 |   await page.screenshot({
  33 |     path: `${resultsDir}/after-login-playwright.png`,
  34 |     fullPage: true
  35 |   });
  36 | 
  37 |   console.log(`Test passed. Screenshot saved to ${resultsDir}/after-login-playwright.png`);
  38 | });
  39 | 
```