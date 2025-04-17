// server.js
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

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
