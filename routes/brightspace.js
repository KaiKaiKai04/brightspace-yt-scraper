// /routes/brightspace.js  //
// This file contains the routes for scraping Brightspace and Rise content
// and serves as the API endpoint for the frontend to interact with.

const express = require('express');
const router = express.Router();
const { scrapeMultipleLinks } = require('../utils/brightspaceScraper');
const { scrapeRiseContent } = require('../utils/riseScraper');


router.post('/scrape', async (req, res) => {
  const { email, password, links } = req.body;

  if (!email || !password || !links || links.length < 1) {
    return res.status(400).json({ error: 'Missing credentials or links' });
  }

  try {
    const allLinks = await scrapeMultipleLinks(email, password, links);
    res.json({ youtubeLinks: allLinks });
  } catch (err) {
    console.error('Scrape route failed:', err);
    res.status(500).json({ error: 'Scraping failed' });
  }
});

router.post('/scrape-rise', async (req, res) => {
  const { link } = req.body;
  if (!link) return res.status(400).json({ success: false, message: 'Missing link' });

  try {
    const result = await scrapeRiseContent(link);
    res.json(result);
  } catch (err) {
    console.error('Scrape Rise failed:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});


module.exports = router;
