// routes/brightspace.js
const express = require('express');
const router = express.Router();

const { scrapeEntireModule, scrapeSingleContent } = require('../utils/brightspaceScraper');
const { transcribeAndSummarize } = require('../utils/openaiHelper');

// In-memory storage for latest results per session
let lastScrapedLinks = [];
let lastTranscripts = {}; // { videoId: { transcript: "...", summary: "..." }, ... }

/**
 * POST /api/scrape/module
 * Scrapes an entire module from Brightspace.
 * Expects: { email, password, moduleUrl }
 */
router.post('/scrape/module', async (req, res) => {
  const { email, password, moduleUrl } = req.body;
  if (!email || !password || !moduleUrl) {
    return res.status(400).json({ error: 'Missing email, password or module URL' });
  }
  try {
    const links = await scrapeEntireModule(email, password, moduleUrl);
    lastScrapedLinks = links;
    lastTranscripts = {}; // Reset previous transcripts for new session
    return res.json({ success: true, links });
  } catch (err) {
    console.error('Scrape module error:', err);
    return res.status(500).json({ error: 'Failed to scrape Brightspace module' });
  }
});

/**
 * POST /api/scrape/content
 * Scrapes a single content page from Brightspace.
 * Expects: { email, password, contentUrl }
 */
router.post('/scrape/content', async (req, res) => {
  const { email, password, contentUrl } = req.body;
  if (!email || !password || !contentUrl) {
    return res.status(400).json({ error: 'Missing email, password or content URL' });
  }
  try {
    const links = await scrapeSingleContent(email, password, contentUrl);
    lastScrapedLinks = links;
    lastTranscripts = {}; // Reset transcripts for new session
    return res.json({ success: true, links });
  } catch (err) {
    console.error('Scrape content error:', err);
    return res.status(500).json({ error: 'Failed to scrape Brightspace content page' });
  }
});

/**
 * POST /api/process
 * Transcribes and summarizes selected YouTube videos.
 * Expects: { videos: [array of video URLs/IDs] }
 */
router.post('/process', async (req, res) => {
  const { videos } = req.body;
  if (!videos || !Array.isArray(videos) || videos.length === 0) {
    return res.status(400).json({ error: 'No videos provided for processing' });
  }
  try {
    const results = {};
    for (let video of videos) {
      const { videoId, transcript, summary } = await transcribeAndSummarize(video);
      results[videoId] = { transcript, summary };
      lastTranscripts[videoId] = { transcript, summary };
    }
    return res.json({ success: true, results });
  } catch (err) {
    console.error('Processing error:', err);
    return res.status(500).json({ error: 'Failed to process videos' });
  }
});

/**
 * GET /api/download/links
 * Downloads all scraped YouTube links as a text file.
 */
router.get('/download/links', (req, res) => {
  if (!lastScrapedLinks.length) {
    return res.status(400).send('No links available. Please run a scrape first.');
  }
  const content = lastScrapedLinks.join('\n');
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Disposition', 'attachment; filename="YouTubeLinks.txt"');
  return res.send(content);
});

/**
 * GET /api/download/transcript/:id
 * Downloads transcript and summary for a given video.
 */
router.get('/download/transcript/:id', (req, res) => {
  const videoId = req.params.id;
  const data = lastTranscripts[videoId];
  if (!data) {
    return res.status(404).send('Transcript not found. Ensure the video was processed.');
  }
  const { transcript, summary } = data;
  const content = 
`YouTube Video ID: ${videoId}
Transcript:
${transcript}

Summary:
${summary}
`;
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Disposition', `attachment; filename="${videoId}_summary.txt"`);
  return res.send(content);
});

module.exports = router;
