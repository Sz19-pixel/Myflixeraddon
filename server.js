#!/usr/bin/env node

const { serveHTTP, publishToCentral } = require('stremio-addon-sdk');
const addonInterface = require('./addon');

const PORT = process.env.PORT || 7000;

// Serve the addon
serveHTTP(addonInterface, {
    port: PORT,
    cache: 3600 // Cache responses for 1 hour
});

console.log(`MyFlixer Stremio Addon is running on port ${PORT}`);
console.log(`Addon URL: http://localhost:${PORT}/manifest.json`);
console.log(`Install URL: http://localhost:${PORT}/configure`);

// Optional: Publish to Stremio Central (uncomment when ready for production)
// publishToCentral("https://your-addon-url.com/manifest.json"); 
