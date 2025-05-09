// server.js
// this file sets up the Express server and serves the frontend files

require('dotenv').config();           // Load environment variables from .env

const express = require('express');
const path = require('path');

// Import the routes
const brightspaceRoutes = require('./routes/brightspace');

const app = express();

// Middleware to parse JSON request bodies
app.use(express.json());

// Serve static frontend files from public/ directory
app.use(express.static(path.join(__dirname, 'public')));

// Mount the Brightspace API routes under /api
app.use('/api', brightspaceRoutes);

// Serve output files for download
const outputDir = path.join(__dirname, 'output');

// Force download for TXT
app.get('/downloads/youtube_links.txt', (req, res) => {
  const filePath = path.join(outputDir, 'youtube_links.txt');
  res.download(filePath, 'youtube_links.txt');
});

// Force download for DOCX
app.get('/downloads/youtube_links.docx', (req, res) => {
  const filePath = path.join(outputDir, 'youtube_links.docx');
  res.download(filePath, 'youtube_links.docx');
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
