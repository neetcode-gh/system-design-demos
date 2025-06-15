# URL Shortener Service

A simple URL shortener service built with Express.js.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
node server.js
```

The server will run on http://localhost:3000

## API Endpoints

### Create Short URL
- **POST** `/api/urls/shorten`
- Request body:
```json
{
    "longUrl": "https://example.com"
}
```
- Response:
```json
{
    "shortUrl": "abc123",
    "longUrl": "https://example.com"
}
```

### Access Shortened URL
- **GET** `/api/urls/{shortUrl}`
- Redirects to the original URL
- Returns 404 if the short URL is not found

## Example Usage

Using curl:
```bash
# Create a short URL
curl -X POST http://localhost:3000/api/urls/shorten \
  -H "Content-Type: application/json" \
  -d '{"longUrl": "https://example.com"}'

# Access the shortened URL
curl -L http://localhost:3000/api/urls/abc123
```

## Notes
- This is a toy implementation using in-memory storage
- URLs will be lost when the server restarts
- No validation of input URLs
- No rate limiting or security features 