const express = require('express');
const router = express.Router();
const { scrapeMultipleLinks } = require('../utils/brightspaceScraper');

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

module.exports = router;
