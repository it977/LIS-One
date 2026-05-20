import { test, expect } from '@playwright/test';

test('real browser login', async ({ page }) => {
  // Capture all console logs from the browser
  page.on('console', msg => console.log(`[BROWSER] ${msg.text()}`));
  page.on('pageerror', err => console.log(`[JS ERROR] ${err.message}`));

  console.log('Navigating to http://127.0.0.1:3000');
  await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle' });

  console.log('Filling login form...');
  await page.fill('#loginUser', 'admin');
  await page.fill('#loginPass', 'admin1234');

  console.log('Clicking login...');
  await page.click('#btnLogin');

  console.log('Waiting for login screen to hide...');
  // Our immediate hide logic uses display:none
  await expect(page.locator('#loginScreen')).not.toBeVisible({ timeout: 10000 });

  console.log('Waiting for dashboard active...');
  const dashboard = page.locator('#dashboard');
  await expect(dashboard).toHaveClass(/active/, { timeout: 10000 });
  await expect(dashboard).toBeVisible();

  console.log('Login successful! Capturing screenshot...');
  const resultsDir = 'test-results';
  const fs = await import('fs');
  if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir);
  
  await page.screenshot({
    path: `${resultsDir}/after-login-playwright.png`,
    fullPage: true
  });

  console.log(`Test passed. Screenshot saved to ${resultsDir}/after-login-playwright.png`);
});
