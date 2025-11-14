# Service Worker Service

A minimal service that provides a service worker registration script for websites.

## Files

- `sw-loader.js` - The main script to include in websites (registers the service worker)
- `service-worker.js` - The actual service worker implementation
- `index.html` - Demo page

## Usage

Include the loader script at the very top of your HTML `<head>` tag for earliest execution:

```html
<!DOCTYPE html>
<html>
<head>
    <script src="https://your-domain.com/sw-loader.js"></script>
    <!-- rest of your head content -->
</head>
<body>
    <!-- your content -->
</body>
</html>
```

## Testing Locally

Service workers require HTTPS (or localhost). To test:

```bash
# Using Python 3
python3 -m http.server 8000

# Using Node.js (install http-server globally first)
npx http-server -p 8000
```

Then visit: http://localhost:8000

## Deployment

1. Host these files on your server with HTTPS
2. Ensure proper CORS headers if serving cross-origin
3. Set appropriate cache headers for `sw-loader.js`
