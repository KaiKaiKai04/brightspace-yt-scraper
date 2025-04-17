const playwright = require('playwright');

/**
 * Normalizes various YouTube URL formats to the standard watch URL.
 * @param {string} url - The original YouTube URL.
 * @returns {string} - Normalized YouTube URL.
 */
function normalizeYouTubeUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtube.com') && parsed.pathname.startsWith('/embed/')) {
      const videoId = parsed.pathname.split('/embed/')[1];
      return `https://www.youtube.com/watch?v=${videoId}`;
    }
    if (parsed.hostname.includes('youtu.be')) {
      return `https://www.youtube.com/watch?v=${parsed.pathname.slice(1)}`;
    }
    return url;
  } catch (err) {
    return url;
  }
}

/**
 * Scrapes YouTube links from the page content using a regex.
 * @param {object} pageOrFrame - A Playwright page or frame instance.
 * @param {Set} videoLinks - Set to collect unique YouTube links.
 */
async function scrapeYouTubeLinksOnPage(pageOrFrame, videoLinks) {
  const html = await pageOrFrame.content();
  const ytRegex = /https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtu\.be\/)[^"'\s]+/g;
  const matches = html.match(ytRegex) || [];
  matches.forEach(link => {
    const clean = normalizeYouTubeUrl(link);
    videoLinks.add(clean);
    console.log(`📺 Found YouTube link via regex: ${clean}`);
  });
}

/**
 * Expands Articulate Rise lessons and scrapes for YouTube links.
 * This function waits for dynamic content, clicks on collapsed sections,
 * looks for standard YouTube links as well as “Watch on YouTube” anchors,
 * and inspects nested iframes.
 *
 * @param {object} frame - The Playwright frame (or page) that contains Rise content.
 * @param {Set} videoLinks - Set to collect unique YouTube links.
 */
async function expandAndScrapeRiseContent(frame, videoLinks) {
  try {
    // Wait for the Rise content to load
    await frame.waitForTimeout(2000);

    // 1. Expand any collapsed sections (using common selectors)
    const expandables = await frame.$$('[aria-expanded="false"], .section-header');
    console.log(`🔍 Found ${expandables.length} collapsed sections in Rise content.`);
    for (const [i, el] of expandables.entries()) {
      try {
        const title = await el.innerText();
        console.log(`📖 Expanding section: ${title || `Section ${i + 1}`}`);
        await el.click();
        // Wait after clicking to allow content to load
        await frame.waitForTimeout(1000);
      } catch (err) {
        console.warn(`⚠️ Could not expand section ${i + 1}:`, err.message);
      }
    }
    
    // Give extra time after all expansions for dynamic content to appear
    await frame.waitForTimeout(2000);

    // 2. Scrape YouTube links from the current DOM via regex
    await scrapeYouTubeLinksOnPage(frame, videoLinks);

    // 3. Look specifically for anchors that say "Watch on YouTube"
    const anchors = await frame.$$('a');
    for (const a of anchors) {
      try {
        const text = (await a.innerText()).trim();
        const href = await a.getAttribute('href');
        if (text.includes('YouTube') && href && href.includes('youtube.com')) {
          const clean = normalizeYouTubeUrl(href);
          videoLinks.add(clean);
          console.log(`📺 Found "Watch on YouTube" link: ${clean}`);
        }
      } catch (err) {
        // Skip any errors from individual anchors
        continue;
      }
    }

    // 4. Check for nested iframes within the Rise content and scrape them too
    const subIframes = await frame.$$('iframe');
    for (const sub of subIframes) {
      const subFrame = await sub.contentFrame();
      if (subFrame) {
        console.log('🌐 Found nested iframe in Rise content, waiting for it to load...');
        await subFrame.waitForTimeout(2000);
        // Scrape using regex on the subframe's content
        await scrapeYouTubeLinksOnPage(subFrame, videoLinks);
        // And check for "Watch on YouTube" anchors inside the subframe
        const subAnchors = await subFrame.$$('a');
        for (const subA of subAnchors) {
          try {
            const subText = (await subA.innerText()).trim();
            const subHref = await subA.getAttribute('href');
            if (subText.includes('YouTube') && subHref && subHref.includes('youtube.com')) {
              const clean = normalizeYouTubeUrl(subHref);
              videoLinks.add(clean);
              console.log(`📺 Found "Watch on YouTube" link in nested iframe: ${clean}`);
            }
          } catch (err) {
            continue;
          }
        }
      }
    }
  } catch (err) {
    console.error('❌ Error in expandAndScrapeRiseContent:', err.message);
  }
}

/**
 * Logs into Brightspace using Microsoft authentication.
 * Navigates to the provided URL and handles potential login popups.
 *
 * @param {object} page - Playwright page instance.
 * @param {string} email - Brightspace email.
 * @param {string} password - Brightspace password.
 * @param {string} url - The Brightspace (or Rise) URL.
 */
async function loginToBrightspace(page, email, password, url) {
  console.log('🔐 Logging into Brightspace...');
  await page.goto(url, { waitUntil: 'networkidle' });

  // Handle redirection to Microsoft login if present
  if (page.url().includes('login.microsoftonline.com')) {
    await page.fill('input#i0116', email);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1000);
    await page.fill('input[name="passwd"]', password);
    await page.click('button[type="submit"]');
    try { await page.click('input#idBtn_Back'); } catch (e) {}
    await page.waitForLoadState('networkidle');
  }

  // If a Microsoft login button is available, click it
  const msBtn = await page.$('button:has-text("Microsoft")');
  if (msBtn) {
    await msBtn.click();
    const [popup] = await Promise.race([
      page.context().waitForEvent('page'),
      page.waitForNavigation()
    ]);
    const loginPage = popup || page;
    await loginPage.fill('input#i0116', email);
    await loginPage.click('button[type="submit"]');
    await loginPage.waitForTimeout(1000);
    await loginPage.fill('input[name="passwd"]', password);
    await loginPage.click('button[type="submit"]');
    try { await loginPage.click('input#idBtn_Back'); } catch (e) {}
    await page.waitForLoadState('networkidle');
  }

  // Click on common Brightspace buttons if present
  const start = await page.$('button:has-text("START COURSE")');
  if (start) {
    await start.click();
    await page.waitForLoadState('networkidle');
  }
  const review = await page.$('button:has-text("REVIEW CONTENT")');
  if (review) {
    await review.click();
    await page.waitForLoadState('networkidle');
  }
}

/**
 * Scrapes all YouTube links from an entire Brightspace module.
 * It logs in, iterates through content pages using the "Next" button,
 * expands any Rise content within iframes, and collects YouTube links.
 *
 * @param {string} email - Brightspace email.
 * @param {string} password - Brightspace password.
 * @param {string} moduleUrl - URL of the Brightspace module.
 * @returns {Array} - Array of unique YouTube links.
 */
async function scrapeEntireModule(email, password, moduleUrl) {
  const browser = await playwright.chromium.launch({
    headless: true, // headful for debugging if needed; headless in prod
    args: ['--no-sandbox']
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  const videoLinks = new Set();

  try {
    // Log in and navigate to the module page
    await loginToBrightspace(page, email, password, moduleUrl);

    // If the URL is a direct Rise URL, handle it accordingly
    if (moduleUrl.includes('rise.articulate.com/share')) {
      console.log(`📘 Accessing Rise Articulate directly: ${moduleUrl}`);
      await page.goto(moduleUrl, { waitUntil: 'domcontentloaded' });
      await expandAndScrapeRiseContent(page, videoLinks);
    } else {
      // Loop through all content pages using the "Next" button
      while (true) {
        await scrapeYouTubeLinksOnPage(page, videoLinks);

        // Check for embedded Rise iframes and process them
        const iframes = await page.$$('iframe');
        for (const iframe of iframes) {
          const src = await iframe.getAttribute('src');
          if (src && src.includes('rise.articulate.com')) {
            const frame = await iframe.contentFrame();
            if (frame) {
              console.log(`🌐 Found embedded Rise iframe: ${src}`);
              await expandAndScrapeRiseContent(frame, videoLinks);
            }
          }
        }

        // Try to find and click the "Next" button to move to the next content page
        const next = await page.$('button:has-text("Next")');
        if (next) {
          await page.evaluate(() => window.scrollBy(0, document.body.scrollHeight));
          await next.click();
          await page.waitForLoadState('networkidle');
        } else {
          break; // No more pages
        }
      }
    }
  } catch (err) {
    console.error('❌ Error scraping module:', err.message);
  } finally {
    await browser.close();
  }
  return Array.from(videoLinks);
}

/**
 * Scrapes YouTube links from a single Brightspace content page.
 *
 * @param {string} email - Brightspace email.
 * @param {string} password - Brightspace password.
 * @param {string} contentUrl - URL of the single content page.
 * @returns {Array} - Array of unique YouTube links.
 */
async function scrapeSingleContent(email, password, contentUrl) {
  const browser = await playwright.chromium.launch({
    headless: true,
    args: ['--no-sandbox']
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  const videoLinks = new Set();

  try {
    // Log in and navigate to the content page
    await loginToBrightspace(page, email, password, contentUrl);

    if (contentUrl.includes('rise.articulate.com/share')) {
      console.log(`📘 Accessing Rise Articulate directly: ${contentUrl}`);
      await page.goto(contentUrl, { waitUntil: 'domcontentloaded' });
      await expandAndScrapeRiseContent(page, videoLinks);
    } else {
      // Process the page normally
      await scrapeYouTubeLinksOnPage(page, videoLinks);
      const iframes = await page.$$('iframe');
      for (const iframe of iframes) {
        const src = await iframe.getAttribute('src');
        if (src && src.includes('rise.articulate.com')) {
          const frame = await iframe.contentFrame();
          if (frame) {
            console.log(`🌐 Found embedded Rise iframe: ${src}`);
            await expandAndScrapeRiseContent(frame, videoLinks);
          }
        }
      }
    }
  } catch (err) {
    console.error('❌ Error scraping content page:', err.message);
  } finally {
    await browser.close();
  }
  return Array.from(videoLinks);
}

module.exports = { scrapeEntireModule, scrapeSingleContent };
