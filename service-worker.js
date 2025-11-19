/**
 * Service Worker
 * Handles caching and offline functionality
 */

// Импортируем конфигурацию
importScripts('sw-config.js');

const CACHE_NAME = 'sw-cache-v5';
const STATIC_CACHE = 'static-v5';

// Собственные ресурсы для кеширования
const STATIC_RESOURCES = [
    '/index.html',
    '/sw-loader.js',
    '/service-worker.js',
    '/sw-config.js'
];

// Флаг для переключения режима проксирования (по умолчанию включен)
let redirectMode = true;

// Таймаут для fetch запросов (в миллисекундах)
const FETCH_TIMEOUT = 2000; // 2 секунды

// Кеш для 404 ответов (чтобы не делать повторные запросы)
const notFoundCache = new Set();

// Функция для fetch с таймаутом
function fetchWithTimeout(url, options, timeout) {
    return Promise.race([
        fetch(url, options).catch(function(error) {
            // Оборачиваем ошибку fetch для единообразной обработки
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

// Слушаем сообщения от страницы
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

// Fetch event - проксируем все запросы с source на target
self.addEventListener('fetch', function(event) {
    const url = new URL(event.request.url);
    
    console.log('[SW] Fetch event:', url.href, 'hostname:', url.hostname, 'port:', url.port, 'pathname:', url.pathname);
    
    // Проверяем, является ли это запросом к нашему домену (не к внешним ресурсам)
    const sourceHostnames = Array.isArray(SW_CONFIG.source.hostname) 
        ? SW_CONFIG.source.hostname 
        : [SW_CONFIG.source.hostname];
    const isOurDomain = sourceHostnames.includes(url.hostname) || 
                        url.port === SW_CONFIG.source.port;
    
    console.log('[SW] isOurDomain:', isOurDomain, 'sourceHostnames:', sourceHostnames);
    
    // Если это запрос к нашему домену
    if (isOurDomain) {
        // Проверяем, является ли это собственным файлом или hook запросом
        const isHookRequest = url.pathname.startsWith('/hook');
        const isOwnFile = url.pathname === '/index.html' || 
                         url.pathname === '/sw-loader.js' || 
                         url.pathname === '/service-worker.js' ||
                         url.pathname === '/sw-config.js' ||
                         url.pathname === '/' ||
                         isHookRequest;
        
        if (isOwnFile) {
            // Особая обработка для /hook - проксируем на целевой сервер
            if (isHookRequest) {
                console.log('[SW] Hook request detected:', event.request.url);
                
                // Извлекаем реальный путь (убираем /hook)
                const realPath = url.pathname.substring(5) || '/'; // substring(5) убирает '/hook'
                
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
            
            // Обычная обработка для остальных собственных файлов
            console.log('[SW] Own file request:', event.request.url);
            // Используем стратегию Cache First для собственных файлов
            event.respondWith(
                caches.match(event.request).then(function(response) {
                    if (response) {
                        console.log('[SW] Serving from cache:', event.request.url);
                        return response;
                    }
                    console.log('[SW] Fetching and caching:', event.request.url);
                    return fetch(event.request).then(function(response) {
                        // Кешируем успешный ответ
                        if (response && response.status === 200) {
                            const responseToCache = response.clone();
                            caches.open(STATIC_CACHE).then(function(cache) {
                                cache.put(event.request, responseToCache);
                            });
                        }
                        return response;
                    }).catch(function(error) {
                        console.error('[SW] Fetch failed for own file:', event.request.url, error);
                        // Пытаемся вернуть из кеша даже если fetch не удался
                        return caches.match(event.request);
                    });
                })
            );
            return;
        }
        
        // Проверяем тип запроса - если это navigation (загрузка страницы), возвращаем index.html
        const isNavigationRequest = event.request.mode === 'navigate';
        
        if (isNavigationRequest) {
            // Для navigation запросов всегда возвращаем index.html из кеша или сети
            console.log('[SW] Navigation request, returning index.html for:', event.request.url);
            event.respondWith(
                caches.match('/index.html').then(function(cachedResponse) {
                    if (cachedResponse) {
                        console.log('[SW] Serving index.html from cache for navigation');
                        return cachedResponse;
                    }
                    return fetch('/index.html').then(function(response) {
                        // Кешируем index.html
                        if (response && response.status === 200) {
                            const responseToCache = response.clone();
                            caches.open(STATIC_CACHE).then(function(cache) {
                                cache.put('/index.html', responseToCache);
                            });
                        }
                        return response;
                    }).catch(function(error) {
                        console.error('[SW] Failed to fetch index.html for navigation:', error);
                        // Последняя попытка - вернуть из кеша
                        return caches.match('/index.html');
                    });
                })
            );
            return;
        }
        
        // Все остальные запросы (fetch, XHR, ресурсы) проксируем на целевой сервер
        console.log('[SW] Resource request, redirect mode:', redirectMode, 'URL:', event.request.url);
        
        const newUrl = new URL(event.request.url);
        newUrl.protocol = SW_CONFIG.target.protocol || 'https:';
        newUrl.hostname = SW_CONFIG.target.hostname;
        newUrl.port = SW_CONFIG.target.port || '';
        
        // Если путь начинается с /static/ но не с /_next/, добавляем /_next
        // Это нужно для чанков Turbopack, которые загружаются с относительными путями
        if (newUrl.pathname.startsWith('/static/') && !newUrl.pathname.startsWith('/_next/')) {
            newUrl.pathname = '/_next' + newUrl.pathname;
        }
        
        console.log('[SW] Proxying resource:', event.request.url, '->', newUrl.href);
        
        // Проверяем, был ли этот URL уже помечен как 404
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
                    
                    // Если получили 404, добавляем в кеш
                    if (response.status === 404) {
                        notFoundCache.add(newUrl.href);
                        console.log('[SW] Added to 404 cache:', newUrl.href);
                    }
                    
                    return response;
                } catch (error) {
                    console.error('[SW] Resource fetch error for', newUrl.href, error);
                    // Добавляем в кеш 404, чтобы не повторять запрос
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
    
    // Все остальные запросы - обычная обработка с обработкой ошибок
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
