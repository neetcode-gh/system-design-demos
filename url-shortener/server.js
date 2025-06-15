const express = require('express');

const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// In-memory storage for URLs
const urlMap = new Map();

// Generate a random 6-character string for short URL
function generateShortUrl() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let shortUrl = '';
    for (let i = 0; i < 6; i++) {
        shortUrl += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return shortUrl;
}

// POST endpoint to shorten a URL
app.post('/api/urls/shorten', (req, res) => {
    const { longUrl } = req.body;
    
    if (!longUrl) {
        return res.status(400).json({ error: 'Long URL is required' });
    }

    // Generate a unique short URL
    let shortUrl;
    do {
        shortUrl = generateShortUrl();
    } while (urlMap.has(shortUrl));

    // Store the mapping
    urlMap.set(shortUrl, longUrl);

    res.json({
        shortUrl,
        longUrl
    });
});

// GET endpoint to redirect to the original URL
app.get('/api/urls/:shortUrl', (req, res) => {
    const { shortUrl } = req.params;
    const longUrl = urlMap.get(shortUrl);

    if (!longUrl) {
        return res.status(404).json({ error: 'Short URL not found' });
    }

    res.redirect(longUrl);
});

app.listen(port, () => {
    console.log(`URL shortener service running at http://localhost:${port}`);
}); 

// Schedule a task to run every minute
setInterval(() => {
  console.log('🕒 every second flush at', new Date().toISOString());
  // your flush logic…
}, 1000);

