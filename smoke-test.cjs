const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push(`[BROWSER] ${msg.text()}`));
  
  try {
    await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle2', timeout: 10000 });
    console.log('Page loaded');
    
    // Fill login
    await page.type('#loginUser', 'admin');
    await page.type('#loginPass', 'admin1234');
    
    console.log('Clicking login...');
    await page.click('#btnLogin');
    
    // Wait for dashboard or timeout
    console.log('Waiting for #dashboard.active...');
    try {
      await page.waitForSelector('#dashboard.active', { visible: true, timeout: 10000 });
      console.log('SUCCESS: Dashboard is visible');
    } catch (e) {
      console.log('FAIL: Dashboard not visible after login');
      await page.screenshot({ path: 'login-fail.png' });
      console.log('Screenshot saved to login-fail.png');
    }
  } catch (e) {
    console.error('Test Error:', e);
  } finally {
    console.log('--- CONSOLE LOGS ---');
    console.log(consoleLogs.join('\n'));
    await browser.close();
  }
})();
