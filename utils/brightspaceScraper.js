// utils/brightspaceScraper.js
const playwright = require('playwright');
const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun } = require('docx');
const express = require('express');
const router = express.Router();

function normalizeYouTubeUrl(url) {
  try {
    if (!url) return null;

    const parsed = new URL(url);

    // YouTube embed: /embed/VIDEO_ID
    if (parsed.hostname.includes('youtube.com') && parsed.pathname.startsWith('/embed/')) {
      const videoId = parsed.pathname.split('/embed/')[1];
      return `https://www.youtube.com/watch?v=${videoId}`;
    }

    // Short youtu.be link
    if (parsed.hostname.includes('youtu.be')) {
      return `https://www.youtube.com/watch?v=${parsed.pathname.slice(1)}`;
    }

    // Watch link: ?v=VIDEO_ID
    if (parsed.hostname.includes('youtube.com') && parsed.searchParams.has('v')) {
      const videoId = parsed.searchParams.get('v');
      return `https://www.youtube.com/watch?v=${videoId}`;
    }

    // Embedly or iframe wrappers
    if (parsed.hostname.includes('cdn.embedly.com')) {
      const rawUrl = parsed.searchParams.get('url') || parsed.searchParams.get('src');
      if (rawUrl && rawUrl.includes('youtube.com/watch')) {
        const embedded = new URL(decodeURIComponent(rawUrl));
        const vid = embedded.searchParams.get('v');
        if (vid) return `https://www.youtube.com/watch?v=${vid}`;
      }
    }

    return null;
  } catch {
    return null;
  }
}


async function scrapeYouTubeLinksOnPage(pageOrFrame, videoLinks, depth = 0) {
  const indent = '  '.repeat(depth);

  const anchors = await pageOrFrame.$$('a[href*="youtube.com"], a[href*="youtu.be"]');
  for (const a of anchors) {
    const href = await a.getAttribute('href');
    if (href) {
      const norm = normalizeYouTubeUrl(href);
      videoLinks.add(norm);
      console.log(`${indent}🔗 Found YouTube link: ${norm}`);
    }
  }

  const iframes = await pageOrFrame.$$('iframe');
  for (const iframe of iframes) {
    try {
      const src = await iframe.getAttribute('src');
      if (src && (src.includes('youtube.com') || src.includes('youtu.be'))) {
        const norm = normalizeYouTubeUrl(src);
        videoLinks.add(norm);
        console.log(`${indent}🎥 Found YouTube iframe: ${norm}`);
      } else {
        const frame = await iframe.contentFrame();
        if (frame) {
          console.log(`${indent}🔍 Entering nested iframe...`);
          await scrapeYouTubeLinksOnPage(frame, videoLinks, depth + 1);
        }
      }
    } catch (err) {
      console.log(`${indent}⚠️ Error accessing iframe:`, err.message);
    }
  }
}


async function clickReviewContent(page) {
  try {
    console.log("🔍 Trying to click 'Review Content' inside shadow DOM...");

    // Wait for the <d2l-button> to appear
    const d2lButton = await page.waitForSelector('d2l-button', { timeout: 10000 });

    // Get its shadow root
    const shadowRoot = await d2lButton.evaluateHandle(el => el.shadowRoot);

    // Query the <button> inside the shadow root
    const realButton = await shadowRoot.$('button');

    if (realButton) {
      await realButton.scrollIntoViewIfNeeded();
      await realButton.click();
      console.log("✅ Clicked 'Review Content' (inside d2l-button)");
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      return true;
    } else {
      console.log("⚠️ Button inside <d2l-button> not found");
      return false;
    }
  } catch (err) {
    console.log("❌ Error in clickReviewContent:", err.message);
    return false;
  }
}



async function expandCollapsedSections(page) {
  const expandable = await page.$$('[aria-expanded="false"], .section-header');
  for (const el of expandable) {
    try {
      await el.scrollIntoViewIfNeeded();
      await el.click();
      await page.waitForTimeout(500);
    } catch {}
  }
}



async function clickAndScrapeAllSections(page, videoLinks) {
  try {
    console.log("🔍 Locating sidebar iframe with lesson links...");

    // Recursively traverse iframes to find the one with 'lesson-link' elements
    const targetFrame = await findFrameWithSelector(page, 'a.lesson-link');
    if (!targetFrame) {
      console.log("❌ Could not find frame with lesson links.");
      return;
    }

    const lessonLinks = await targetFrame.$$('a.lesson-link');
    console.log(`✅ Found ${lessonLinks.length} lesson links inside nested iframe.`);

    for (let i = 0; i < lessonLinks.length; i++) {
      const reloadedLinks = await targetFrame.$$('a.lesson-link');
      const link = reloadedLinks[i];

      try {
        await link.scrollIntoViewIfNeeded();
        await link.click();
        console.log(`➡️ Clicked lesson ${i + 1}/${lessonLinks.length}`);
        await page.waitForTimeout(3000); // wait for iframe content to reload

        await scrollToBottom(page);
        await scrapeYouTubeLinksOnPage(page, videoLinks);
      } catch (err) {
        console.log(`⚠️ Could not click lesson ${i + 1}:`, err.message);
      }
    }
  } catch (err) {
    console.log("❌ Error in clickAndScrapeAllSections:", err.message);
  }
}




async function scrollToBottom(page) {
  let prevHeight = 0;
  let height = await page.evaluate(() => document.body.scrollHeight);
  while (height > prevHeight) {
    prevHeight = height;
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    height = await page.evaluate(() => document.body.scrollHeight);
  }
}

async function saveLinksAsDocx(links) {
  const doc = new Document({
    sections: [
      {
        children: links.map(link => new Paragraph(new TextRun(link))),
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const outputPath = path.join(__dirname, '../output/youtube_links.docx');
  fs.writeFileSync(outputPath, buffer);
  console.log(`📄 DOCX saved to: ${outputPath}`);
}

async function loginToBrightspace(page, email, password, url) {
  console.log('🔐 Logging into Brightspace...');
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

  try {
    await page.waitForSelector('#otherTile', { timeout: 3000 });
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
      page.locator('#otherTile').click()
    ]);
    console.log("🟡 Clicked 'Use another account'");
  } catch {
    console.log("ℹ️ '#otherTile' not found or auto-redirected. Continuing...");
  }

  await page.waitForSelector('input[type="email"], input#i0116', { timeout: 15000 });
  await page.fill('input[type="email"], input#i0116', email);
  console.log('📧 Email entered');

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
    page.locator('input[value="Next"], button[type="submit"], #idSIButton9').click()
  ]);
  console.log('➡️ Clicked Next');

  await page.waitForSelector('#i0118', { timeout: 15000 });
  const passwordInput = page.locator('#i0118');
  await passwordInput.click({ timeout: 5000 });
  await passwordInput.type(password, { delay: 100 });
  await page.waitForTimeout(300);

  const enteredPassword = await passwordInput.inputValue();
  if (!enteredPassword || enteredPassword.trim().length === 0) {
    throw new Error('❌ Password field still empty after typing. Aborting login.');
  }
  console.log('🔑 Password typed');

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }),
    page.locator('input[type="submit"], #idSIButton9').click()
  ]);
  console.log('🔓 Clicked Sign In');

  try {
    await page.waitForSelector('d2l-navigation', { timeout: 15000 });
    console.log('✅ Brightspace navigation loaded');
  } catch {
    console.log('⏳ No navigation element found, waiting briefly...');
    await page.waitForTimeout(5000);
  }

  try {
    await page.click('#idBtn_Back', { timeout: 5000 });
    console.log('🙅 Skipped stay signed in');
  } catch {
    console.log('✅ No stay signed in prompt');
  }

  await page.waitForLoadState('networkidle');
  console.log('✅ Successfully logged into Brightspace');
}

async function clickStartOrReviewCourse(page) {
  try {
    const startBtn = await page.$('text="Start Course"');
    if (startBtn) {
      await startBtn.scrollIntoViewIfNeeded();
      await startBtn.click();
      console.log("✅ Clicked 'Start Course'");
      await page.waitForTimeout(2000);
      return true;
    } else {
      console.log("⚠️ 'Start Course' button not found");
      return false;
    }
  } catch (err) {
    console.log("❌ Error clicking 'Start Course':", err.message);
    return false;
  }
}

async function scrapeMultipleLinks(email, password, links) {
  const browser = await playwright.chromium.launch({ headless: false, args: ['--no-sandbox'] });
  const context = await browser.newContext();
  const page = await context.newPage();
  const videoLinks = new Set();
  let status = 'success';

  try {
    for (const link of links) {
      console.log(`\n🔗 Processing: ${link}`);

      // Step 1: Login
      await loginToBrightspace(page, email, password, link);

      // Step 2: Click 'Start Course' or 'Review Content'
      const started = await clickStartOrReviewCourse(page);
      if (!started) await clickReviewContent(page);

      // Step 3: Expand hidden things & scroll
      await expandCollapsedSections(page);
      await scrollToBottom(page);

      // Step 4: Always scrape the main content
      console.log("🔍 Scraping YouTube links on the main page...");
      await scrapeYouTubeLinksOnPage(page, videoLinks);

      // Step 5: Try scraping sections (if available)
      try {
        const hasSequence = await page.$('d2l-sequence-viewer');
        if (hasSequence) {
          console.log("📋 Attempting to scrape sections...");
          await clickAndScrapeAllSections(page, videoLinks);
        } else {
          console.log("⚠️ No sequence viewer. Skipping section clicks.");
        }
      } catch (sectionErr) {
        console.log("⚠️ Could not scrape sections:", sectionErr.message);
      }
    }
  } catch (err) {
    status = 'failed';
    console.error('❌ Error during scraping:', err.message);
  } finally {
    await browser.close();
  }

  // Save results
  const outputDir = path.join(__dirname, '../output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  const textPath = path.join(outputDir, 'youtube_links.txt');
  fs.writeFileSync(textPath, Array.from(videoLinks).join('\n'));
  console.log(`📁 TXT saved to: ${textPath}`);

  await saveLinksAsDocx(Array.from(videoLinks));
  return { links: Array.from(videoLinks), status };
}

async function findFrameWithSelector(frameOrPage, selector) {
  const elements = await frameOrPage.$$(selector);
  if (elements.length > 0) return frameOrPage;

  const childFrames = frameOrPage.frames ? frameOrPage.frames() : [];
  for (const child of childFrames) {
    const found = await findFrameWithSelector(child, selector);
    if (found) return found;
  }
  return null;
}

module.exports = {
  scrapeMultipleLinks
};

