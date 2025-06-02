const puppeteer = require('puppeteer');
const fs = require('fs');

// Single comment
const COMMENT = `📣 Cô tìm 5 bạn nhỏ học Lớp ✍️ Luyện Chữ & 🎒 Hành Trang vào lớp 1 ib cô nhé`;
const POST_URL = 'https://www.facebook.com/groups/hoiphuhuynhbmt';
const SCROLL_PAUSE_TIME = 5000; // 5 seconds pause between scrolls
const MAX_SCROLL_ATTEMPTS = 50; // Increased max scroll attempts
const COMMENT_DELAY = 3000; // 3 seconds between comments
const SCROLL_AMOUNT = 800; // Amount to scroll each time
const CONTENT_LOAD_WAIT = 3000; // Wait time for content to load

(async () => {
  let browser;
  try {
    // More specific browser launch options
    browser = await puppeteer.launch({
      headless: false,
      executablePath: process.platform === 'darwin' 
        ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
        : process.platform === 'win32'
        ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
        : '/usr/bin/google-chrome',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-site-isolation-trials'
      ],
      ignoreHTTPSErrors: true,
      defaultViewport: null,
      pipe: true,
      timeout: 60000
    });

    const context = await browser.createIncognitoBrowserContext();
    const page = await context.newPage();
    
    // Set a longer timeout
    page.setDefaultTimeout(60000);

    // Load cookies
    try {
      const cookieData = fs.readFileSync('cookie.json', 'utf8');
      const cookieJson = JSON.parse(cookieData);
      
      if (!cookieJson.cookies || !Array.isArray(cookieJson.cookies)) {
        throw new Error('Invalid cookie format. Expected {cookies: [...]}');
      }

      for (const cookie of cookieJson.cookies) {
        await page.setCookie({
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path,
          expires: cookie.expirationDate,
          httpOnly: cookie.httpOnly,
          secure: cookie.secure,
          sameSite: cookie.sameSite === 'no_restriction' ? 'None' : cookie.sameSite
        });
      }
    } catch (error) {
      console.error('Error loading cookies:', error);
      throw new Error('Failed to load cookies. Please make sure cookie.json exists and is valid.');
    }

    // Go to Facebook with retry logic
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        await page.goto('https://www.facebook.com/', { 
          waitUntil: 'networkidle2',
          timeout: 60000 
        });
        break;
      } catch (error) {
        retryCount++;
        if (retryCount === maxRetries) throw error;
        console.log(`Retrying Facebook load (${retryCount}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    // Wait for the main page to ensure we are logged in
    await page.waitForSelector('[role="feed"]', { timeout: 60000 });

    // Navigate to the target page
    await page.goto(POST_URL, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // Wait for the page to load
    await page.waitForSelector('[role="main"]', { timeout: 60000 });

    let scrollAttempts = 0;
    let lastHeight = 0;
    let noNewContentCount = 0;
    const commentedPosts = new Set(); // Track which posts we've commented on

    // Function to check if we've reached the end
    const isEndOfPage = async () => {
      const currentHeight = await page.evaluate(() => document.body.scrollHeight);
      const viewportHeight = await page.evaluate(() => window.innerHeight);
      const scrollPosition = await page.evaluate(() => window.scrollY);
      
      // If we're near the bottom (within 100px) or can't scroll further
      return (currentHeight - (scrollPosition + viewportHeight)) < 100 || currentHeight === lastHeight;
    };

    // Function to wait for content to load
    const waitForContentLoad = async () => {
      try {
        console.log('Waiting for content to load...');
        
        // Wait for posts to be available
        await page.waitForFunction(() => {
          return document.querySelectorAll('[role="article"]').length > 0;
        }, { timeout: 15000 }).catch(() => console.log('No posts found'));
        
        // Monitor for network activity to be idle
        let lastRequestCount = 0;
        let stableCount = 0;
        
        // Wait until network activity stabilizes
        for (let i = 0; i < 5; i++) {
          const currentRequests = await page.evaluate(() => {
            return performance.getEntries().length;
          });
          
          if (currentRequests === lastRequestCount) {
            stableCount++;
          } else {
            stableCount = 0;
            lastRequestCount = currentRequests;
          }
          
          if (stableCount >= 3) {
            console.log('Network activity stabilized');
            break;
          }
          
          await page.waitForTimeout(1000);
        }
        
        // Additional wait for content to render
        await page.waitForTimeout(CONTENT_LOAD_WAIT);
        console.log('Content loaded');
      } catch (error) {
        console.log('Error waiting for content:', error);
      }
    };

    while (scrollAttempts < MAX_SCROLL_ATTEMPTS) {
      // Wait for content to load after scroll
      await waitForContentLoad();

      // Find all posts in the current viewport
      const posts = await page.$$('[role="article"]');
      console.log(`Found ${posts.length} posts in current viewport`);
      
      let commentedInThisViewport = false;
      
      for (const post of posts) {
        try {
          // Get post ID or unique identifier
          const postId = await post.evaluate(el => {
            // Try to get a unique identifier for the post
            const dataFt = el.getAttribute('data-ft');
            if (dataFt) return dataFt;
            
            // If no data-ft, try to get the post ID from the URL
            const links = el.querySelectorAll('a[href*="/posts/"]');
            for (const link of links) {
              const href = link.getAttribute('href');
              if (href && href.includes('/posts/')) {
                return href.split('/posts/')[1].split('?')[0];
              }
            }
            
            // If all else fails, use the element's ID
            return el.id;
          });
          
          // Skip if we've already commented on this post
          if (commentedPosts.has(postId)) {
            console.log('Skipping already commented post:', postId);
            continue;
          }

          // Find comment box within this post
          const inputHandle = await post.$('div[aria-label*="Bình luận dưới tên"][contenteditable="true"][data-lexical-editor="true"]');
          
          if (!inputHandle) {
            console.log('No comment box found in post:', postId);
            continue;
          }

          // Check if the comment box is visible
          const isVisible = await inputHandle.evaluate(el => {
            const rect = el.getBoundingClientRect();
            return rect.top >= 0 && rect.bottom <= window.innerHeight;
          });

          if (!isVisible) {
            console.log('Comment box not visible in post:', postId);
            continue;
          }

          // Scroll the comment box into view
          await inputHandle.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
          await page.waitForTimeout(1000); // Wait for scroll to complete

          // Focus and type
          await inputHandle.focus();
          await page.waitForTimeout(500); // Wait for focus
          await page.keyboard.type(COMMENT, { delay: 50 });

          // Press Enter
          await page.keyboard.press('Enter');
          console.log('Comment posted successfully on post:', postId);
          
          // Mark this post as commented
          commentedPosts.add(postId);
          commentedInThisViewport = true;
          
          // Wait between comments
          await page.waitForTimeout(COMMENT_DELAY);
        } catch (err) {
          console.error('Error posting comment:', err);
          continue;
        }
      }

      // Only scroll if we've commented on all visible posts
      if (!commentedInThisViewport) {
        // Scroll down smoothly
        await page.evaluate((amount) => {
          window.scrollBy({
            top: amount,
            behavior: 'smooth'
          });
        }, SCROLL_AMOUNT);

        // Wait for content to load
        await page.waitForTimeout(SCROLL_PAUSE_TIME);
      }

      // Check if we've reached the end
      const endReached = await isEndOfPage();
      if (endReached) {
        noNewContentCount++;
        if (noNewContentCount >= 3) { // If no new content after 3 attempts, we're probably at the bottom
          console.log('Reached the end of the page');
          break;
        }
      } else {
        noNewContentCount = 0;
      }

      lastHeight = await page.evaluate(() => document.body.scrollHeight);
      scrollAttempts++;
      
      console.log(`Scroll attempt ${scrollAttempts}/${MAX_SCROLL_ATTEMPTS}`);
      console.log(`Total posts commented on so far: ${commentedPosts.size}`);
    }

    console.log('Finished scrolling and commenting');
    console.log(`Total posts commented on: ${commentedPosts.size}`);
    
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    // Keep browser open for debugging
    // if (browser) await browser.close();
  }
})().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 