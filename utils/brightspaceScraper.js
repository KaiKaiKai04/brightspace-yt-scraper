// utils/brightspaceScraper.js
const playwright = require('playwright');
const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun } = require('docx');
const express = require('express');
const router = express.Router();

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

async function scrapeYouTubeLinksOnPage(pageOrFrame, videoLinks) {
  const anchors = await pageOrFrame.$$('a[href*="youtube.com"], a[href*="youtu.be"]');
  for (const a of anchors) {
    const href = await a.getAttribute('href');
    if (href) videoLinks.add(normalizeYouTubeUrl(href));
  }

  const iframes = await pageOrFrame.$$('iframe[src*="youtube.com"], iframe[src*="youtu.be"]');
  for (const f of iframes) {
    const src = await f.getAttribute('src');
    if (src) videoLinks.add(normalizeYouTubeUrl(src));
  }
}

async function clickStartOrReviewCourse(page) {
  try {
    const buttons = await page.$$('text=Start Course, text=Review Content');
    for (const btn of buttons) {
      if (await btn.isVisible()) {
        await btn.scrollIntoViewIfNeeded();
        await btn.click();
        console.log('▶️ Clicked Start/Review Course');
        await page.waitForTimeout(2000);
        return;
      }
    }
  } catch (err) {
    console.log('ℹ️ No Start or Review button found');
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

async function scrapeMultipleLinks(email, password, links) {
  const browser = await playwright.chromium.launch({ headless: false, args: ['--no-sandbox'] });
  const context = await browser.newContext();
  const page = await context.newPage();
  const videoLinks = new Set();
  let status = 'success';

  try {
    for (const link of links) {
      console.log(`\n🔗 Processing: ${link}`);
      await loginToBrightspace(page, email, password, link);
      await clickStartOrReviewCourse(page);
      await expandCollapsedSections(page);
      await scrollToBottom(page);
      await scrapeYouTubeLinksOnPage(page, videoLinks);
    }
  } catch (err) {
    status = 'failed';
    console.error('❌ Error during multi-link scraping:', err);
  } finally {
    await browser.close();
  }

  const textPath = path.join(__dirname, '../output/youtube_links.txt');
  fs.writeFileSync(textPath, Array.from(videoLinks).join('\n'));
  console.log(`📁 TXT saved to: ${textPath}`);

  await saveLinksAsDocx(Array.from(videoLinks));
  return { links: Array.from(videoLinks), status };
}

module.exports = { scrapeMultipleLinks };
