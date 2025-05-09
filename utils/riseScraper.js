// utils/riseScraper.js
// This file contains the scraper for Rise content on Brightspace
// and is used by the API routes to perform the scraping tasks.

const playwright = require('playwright');
const path = require('path');
const fs = require('fs');
const {
  saveLinksAsDocx,
  normalizeYouTubeUrl,
  scrapeYouTubeLinksOnPage
} = require('./brightspaceScraper');

// 🍪 Handle cookie banner using robust fallback
async function handleCookieConsent(page) {
  try {
    await page.waitForTimeout(2000);
    const acceptBtn = await page.$('button:has-text("Accept All")');
    if (acceptBtn) {
      console.log('🍪 Clicking cookie consent: Accept All');
      await acceptBtn.click();
      await page.waitForTimeout(1000);
    } else {
      console.log('🍪 No cookie banner found');
    }
  } catch (err) {
    console.warn('⚠️ Cookie consent handling failed:', err.message);
  }
}

async function scrapeRiseContent(link) {
  const browser = await playwright.chromium.launch({ headless: false, args: ['--no-sandbox'] });
  const context = await browser.newContext();
  const page = await context.newPage();
  const videoLinks = new Set();
  let status = 'success';

  try {
    console.log(`\n🔗 Navigating to Rise course: ${link}`);
    await page.goto(link, { waitUntil: 'domcontentloaded' });

    // Step 1: Handle cookie popup
    await handleCookieConsent(page);

    // Step 2: Try clicking Start/Resume button
    try {
      await page.waitForTimeout(2000);
      const enrolledBtn = await page.$('a.cover__header-content-action-link.overview__button-enrolled');
      if (enrolledBtn) {
        console.log('▶️ Clicking enrolled Start/Resume');
        await enrolledBtn.click();
      } else {
        const fallbackBtn =
          await page.$('a.cover__header-content-action-link') ||
          await page.$('text="Start course"') ||
          await page.$('text="Resume course"');
        if (fallbackBtn) {
          console.log('▶️ Clicking fallback Start/Resume');
          await fallbackBtn.click();
        } else {
          console.warn('⚠️ No Start/Resume button found — continuing anyway');
        }
      }
    } catch (err) {
      console.error('❌ Start/Resume click failed:', err.message);
    }

    // Step 3: Wait for first lesson to load
    await page.waitForTimeout(2500);

    // Step 4: Traverse lessons
    let hasNext = true;
    let tries = 0;
    const maxTries = 50;

    while (hasNext && tries++ < maxTries) {
      console.log(`🔍 Scraping lesson ${tries}`);
      await scrapeYouTubeLinksOnPage(page, videoLinks);

      // Scroll to bottom
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1000);

      // Look for "next lesson" link at bottom
      const nextBtn =
        await page.$('a.lesson-nav-link__link[data-direction="next"]') ||
        await page.$('a[data-direction="next"]');

      if (nextBtn) {
        const href = await nextBtn.getAttribute('href');
        console.log(`➡️ Going to next lesson: ${href}`);
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {}),
          nextBtn.click()
        ]);
        await page.waitForTimeout(1500);
      } else {
        console.log('🚫 No more lessons found.');
        hasNext = false;
      }
    }

  } catch (err) {
    status = 'failed';
    console.error('❌ Error during Rise scraping:', err.message);
  } finally {
    await browser.close();
  }

  // Step 5: Save output
  const linksArr = Array.from(videoLinks);
  const outputDir = path.join(__dirname, '../output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
  const textPath = path.join(outputDir, 'youtube_links.txt');
  fs.writeFileSync(textPath, linksArr.join('\n'));
  await saveLinksAsDocx(Array.from(videoLinks).filter(link => link && link.trim()));

  console.log(`📁 TXT saved to: ${textPath}`);
  console.log(`📄 DOCX saved to: ${path.join(outputDir, 'youtube_links.docx')}`);

  return { success: status === 'success', links: linksArr, status };
}

module.exports = { scrapeRiseContent };
