/**
 * Service Worker
 * Handles caching and offline functionality
 */

// Import configuration
importScripts('sw-config.js');

const CACHE_NAME = 'sw-cache-v5';
const STATIC_CACHE = 'static-v5';

// Own resources for caching
const STATIC_RESOURCES = [
    '/index.html',
    '/sw-loader.js',
    '/service-worker.js',
    '/sw-config.js'
];

// Flag to toggle proxy mode (enabled by default)
let redirectMode = true;

// Timeout for fetch requests (in milliseconds)
const FETCH_TIMEOUT = 2000; // 2 seconds

// Cache for 404 responses (to avoid repeated requests)
const notFoundCache = new Set();

// Function for fetch with timeout
function fetchWithTimeout(url, options, timeout) {
    return Promise.race([
        fetch(url, options).catch(function(error) {
            // Wrap fetch error for uniform handling
            console.error('[SW] Fetch failed:', url, error.message);
            throw error;
        }),
        new Promise(function(_, reject) {
            setTimeout(function() {
                reject(new Error('Request timeout'));
            }, timeout);
        })
    ]);
}

// Listen to messages from the page
self.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'ENABLE_REDIRECT') {
        redirectMode = true;
        console.log('[SW] Redirect mode enabled');
    } else if (event.data && event.data.type === 'DISABLE_REDIRECT') {
        redirectMode = false;
        console.log('[SW] Redirect mode disabled');
    }
});

// Install event - cache resources
self.addEventListener('install', function(event) {
    console.log('[SW] Service Worker installing');
    
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(function(cache) {
                console.log('[SW] Caching static resources:', STATIC_RESOURCES);
                return cache.addAll(STATIC_RESOURCES);
            })
            .then(function() {
                console.log('[SW] Static resources cached successfully');
                return self.skipWaiting();
            })
            .catch(function(error) {
                console.error('[SW] Failed to cache static resources:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', function(event) {
    console.log('[SW] Service Worker activating');
    
    const currentCaches = [CACHE_NAME, STATIC_CACHE];
    
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.map(function(cacheName) {
                    if (!currentCaches.includes(cacheName)) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(function() {
            console.log('[SW] Service Worker activated');
            return self.clients.claim();
        })
    );
});

// Fetch event - proxy all requests from source to target
self.addEventListener('fetch', function(event) {
    const url = new URL(event.request.url);
    
    console.log('[SW] Fetch event:', url.href, 'hostname:', url.hostname, 'port:', url.port, 'pathname:', url.pathname);
    
    // Check if this is a request to our domain (not to external resources)
    const sourceHostnames = Array.isArray(SW_CONFIG.source.hostname) 
        ? SW_CONFIG.source.hostname 
        : [SW_CONFIG.source.hostname];
    const isOurDomain = sourceHostnames.includes(url.hostname) || 
                        url.port === SW_CONFIG.source.port;
    
    console.log('[SW] isOurDomain:', isOurDomain, 'sourceHostnames:', sourceHostnames);
    
    // If this is a request to our domain
    if (isOurDomain) {
        // Check if this is an own file or hook request
        const isHookRequest = url.pathname.startsWith('/hook');
        const isOwnFile = url.pathname === '/index.html' || 
                         url.pathname === '/sw-loader.js' || 
                         url.pathname === '/service-worker.js' ||
                         url.pathname === '/sw-config.js' ||
                         url.pathname === '/' ||
                         isHookRequest;
        
        if (isOwnFile) {
            // Special handling for /hook - proxy to target server
            if (isHookRequest) {
                console.log('[SW] Hook request detected:', event.request.url);
                
                // Extract real path (remove /hook)
                const realPath = url.pathname.substring(5) || '/'; // substring(5) removes '/hook'
                
                const newUrl = new URL(event.request.url);
                newUrl.protocol = SW_CONFIG.target.protocol || 'https:';
                newUrl.hostname = SW_CONFIG.target.hostname;
                newUrl.port = SW_CONFIG.target.port || '';
                newUrl.pathname = realPath;
                
                console.log('[SW] Proxying hook request:', event.request.url, '->', newUrl.href);
                
                event.respondWith(
                    (async function() {
                        try {
                            const response = await fetchWithTimeout(newUrl.href, {
                                method: event.request.method,
                                headers: event.request.headers,
                                mode: 'cors',
                                credentials: 'omit'
                            }, FETCH_TIMEOUT);
                            
                            console.log('[SW] Hook request success:', newUrl.href, 'Status:', response.status);
                            return response;
                        } catch (error) {
                            console.error('[SW] Hook request error for', newUrl.href, error);
                            return new Response('Error loading from target server: ' + error.message, {
                                status: 503,
                                statusText: 'Service Unavailable'
                            });
                        }
                    })()
                );
                return;
            }
            
            // Normal handling for other own files
            console.log('[SW] Own file request:', event.request.url);
            // Use Cache First strategy for own files
            event.respondWith(
                caches.match(event.request).then(function(response) {
                    if (response) {
                        console.log('[SW] Serving from cache:', event.request.url);
                        return response;
                    }
                    console.log('[SW] Fetching and caching:', event.request.url);
                    return fetch(event.request).then(function(response) {
                        // Cache successful response
                        if (response && response.status === 200) {
                            const responseToCache = response.clone();
                            caches.open(STATIC_CACHE).then(function(cache) {
                                cache.put(event.request, responseToCache);
                            });
                        }
                        return response;
                    }).catch(function(error) {
                        console.error('[SW] Fetch failed for own file:', event.request.url, error);
                        // Try to return from cache even if fetch failed
                        return caches.match(event.request);
                    });
                })
            );
            return;
        }
        
        // Check request type - if it's navigation (page load), return index.html
        const isNavigationRequest = event.request.mode === 'navigate';
        
        if (isNavigationRequest) {
            // For navigation requests always return index.html from cache or network
            console.log('[SW] Navigation request, returning index.html for:', event.request.url);
            event.respondWith(
                caches.match('/index.html').then(function(cachedResponse) {
                    if (cachedResponse) {
                        console.log('[SW] Serving index.html from cache for navigation');
                        return cachedResponse;
                    }
                    return fetch('/index.html').then(function(response) {
                        // Cache index.html
                        if (response && response.status === 200) {
                            const responseToCache = response.clone();
                            caches.open(STATIC_CACHE).then(function(cache) {
                                cache.put('/index.html', responseToCache);
                            });
                        }
                        return response;
                    }).catch(function(error) {
                        console.error('[SW] Failed to fetch index.html for navigation:', error);
                        // Last attempt - return from cache
                        return caches.match('/index.html');
                    });
                })
            );
            return;
        }
        
        // All other requests (fetch, XHR, resources) proxy to target server
        console.log('[SW] Resource request, redirect mode:', redirectMode, 'URL:', event.request.url);
        
        const newUrl = new URL(event.request.url);
        newUrl.protocol = SW_CONFIG.target.protocol || 'https:';
        newUrl.hostname = SW_CONFIG.target.hostname;
        newUrl.port = SW_CONFIG.target.port || '';
        
        // If path starts with /static/ but not with /_next/, add /_next
        // This is needed for Turbopack chunks that load with relative paths
        if (newUrl.pathname.startsWith('/static/') && !newUrl.pathname.startsWith('/_next/')) {
            newUrl.pathname = '/_next' + newUrl.pathname;
        }
        
        console.log('[SW] Proxying resource:', event.request.url, '->', newUrl.href);
        
        // Check if this URL was already marked as 404
        if (notFoundCache.has(newUrl.href)) {
            console.log('[SW] Returning cached 404 for:', newUrl.href);
            event.respondWith(
                new Response('Not Found (cached)', {
                    status: 404,
                    statusText: 'Not Found'
                })
            );
            return;
        }
        
        event.respondWith(
            (async function() {
                try {
                    const response = await fetchWithTimeout(newUrl.href, {
                        method: event.request.method,
                        headers: event.request.headers,
                        mode: 'cors',
                        credentials: 'omit'
                    }, FETCH_TIMEOUT);
                    
                    console.log('[SW] Resource success:', newUrl.href, 'Status:', response.status);
                    
                    // If we got 404, add to cache
                    if (response.status === 404) {
                        notFoundCache.add(newUrl.href);
                        console.log('[SW] Added to 404 cache:', newUrl.href);
                    }
                    
                    return response;
                } catch (error) {
                    console.error('[SW] Resource fetch error for', newUrl.href, error);
                    // Add to 404 cache to avoid repeating the request
                    notFoundCache.add(newUrl.href);
                    return new Response('Error loading resource: ' + error.message, {
                        status: 503,
                        statusText: 'Service Unavailable'
                    });
                }
            })()
        );
        return;
    }
    
    // All other requests - normal handling with error handling
    event.respondWith(
        fetch(event.request).catch(function(error) {
            console.error('[SW] External fetch error for', event.request.url, error);
            return new Response('Network error: ' + error.message, {
                status: 503,
                statusText: 'Service Unavailable'
            });
        })
    );
});
