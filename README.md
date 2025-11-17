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

### HTTP (localhost only)
```bash
npm run dev
```
Then visit: http://localhost:8000 or http://127.0.0.1:8000

### HTTPS (for custom domains)

If you need to test with a custom domain (e.g., `1ottoland.com`), you need HTTPS:

1. **Add domain to hosts file** (`/etc/hosts`):
```
127.0.0.1       1ottoland.com
```

2. **Create SSL certificate** (already included in repo, or regenerate):
```bash
openssl req -x509 -newkey rsa:2048 -nodes -keyout localhost-key.pem -out localhost-cert.pem -days 365 -subj '/CN=1ottoland.com' -addext 'subjectAltName=DNS:1ottoland.com'
```

3. **Add certificate to macOS trusted certificates**:
```bash
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain localhost-cert.pem
```

4. **Restart your browser completely** (close all windows)

5. **Start HTTPS server**:
```bash
npm run dev:https
```

6. Visit: https://1ottoland.com:8000

**Note**: If you still see certificate errors, enable `chrome://flags/#allow-insecure-localhost` in Chrome/Edge.

## Deployment

1. Host these files on your server with HTTPS
2. Ensure proper CORS headers if serving cross-origin
3. Set appropriate cache headers for `sw-loader.js`
