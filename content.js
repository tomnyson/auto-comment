const puppeteer = require('puppeteer');
const fs = require('fs');

const COMMENTS = ['Comment 1', 'Comment 2'];
const INTERVAL = 3000; // 3 seconds

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  // Load cookies
  const cookies = JSON.parse(fs.readFileSync('cookie.json', 'utf8'));
  await page.setCookie(...cookies);

  // Go to Facebook
  await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle2' });

  // Wait for the main page to ensure we are logged in
  await page.waitForSelector('[role="feed"]', { timeout: 10000 });

  // Navigate to the target post manually or insert a URL here
  await page.goto('https://www.facebook.com/daotaolaptrinh2024');

  for (let i = 0; i < COMMENTS.length; i++) {
    try {
      // Find the comment box
      const inputHandle = await page.$('div[aria-label*="Bình luận dưới tên"][contenteditable="true"][data-lexical-editor="true"]');

      if (!inputHandle) {
        console.error('Comment input not found');
        continue;
      }

      // Focus and type
      await inputHandle.focus();
      await page.keyboard.type(COMMENTS[i], { delay: 50 });

      // Press Enter
      await page.keyboard.press('Enter');

      console.log(`Posted comment ${i + 1}`);
      await page.waitForTimeout(INTERVAL);
    } catch (err) {
      console.error('Error posting comment:', err);
    }
  }

  // Optionally close the browser
  // await browser.close();
})();