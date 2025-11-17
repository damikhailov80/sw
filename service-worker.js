/**
 * Service Worker
 * Handles caching and offline functionality
 */

// Импортируем конфигурацию
importScripts('sw-config.js');

const CACHE_NAME = 'sw-cache-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/service-worker.js',
    '/sw-loader.js',
    '/sw-config.js'
];

// Флаг для переключения режима перенаправления
// По умолчанию ВЫКЛЮЧЕН - включается после загрузки страницы
let redirectMode = false;

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
    console.log('Service Worker installing');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function(cache) {
                console.log('Cache opened');
                return cache.addAll(urlsToCache);
            })
            .then(function() {
                return self.skipWaiting();
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', function(event) {
    console.log('Service Worker activating');
    
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.map(function(cacheName) {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(function() {
            return self.clients.claim();
        })
    );
});

// Fetch event - проксируем все запросы с source на target
self.addEventListener('fetch', function(event) {
    const url = new URL(event.request.url);
    
    // Если это запрос к исходному серверу
    if (url.hostname === SW_CONFIG.source.hostname && url.port === SW_CONFIG.source.port) {
        // Пропускаем собственные файлы - они должны загружаться с 127.0.0.1:8000
        const isOwnFile = url.pathname === '/index.html' || 
                         url.pathname === '/sw-loader.js' || 
                         url.pathname === '/service-worker.js' ||
                         url.pathname === '/sw-config.js';
        
        if (isOwnFile) {
            console.log('[SW] Allowing own file:', event.request.url);
            event.respondWith(fetch(event.request));
            return;
        }
        
        // Проверяем тип запроса - если это navigation (загрузка страницы), возвращаем index.html
        const isNavigationRequest = event.request.mode === 'navigate';
        
        if (isNavigationRequest) {
            // Для navigation запросов всегда возвращаем index.html
            console.log('[SW] Navigation request, returning index.html for:', event.request.url);
            event.respondWith(
                fetch('/index.html').then(function(response) {
                    return new Response(response.body, {
                        status: 200,
                        statusText: 'OK',
                        headers: response.headers
                    });
                })
            );
            return;
        }
        
        // Все остальные запросы (fetch, XHR, ресурсы) проксируем на целевой сервер если режим включен
        if (redirectMode) {
            const newUrl = new URL(event.request.url);
            newUrl.hostname = SW_CONFIG.target.hostname;
            newUrl.port = SW_CONFIG.target.port;
            
            // Если путь начинается с /static/ но не с /_next/, добавляем /_next
            // Это нужно для чанков Turbopack, которые загружаются с относительными путями
            if (newUrl.pathname.startsWith('/static/') && !newUrl.pathname.startsWith('/_next/')) {
                newUrl.pathname = '/_next' + newUrl.pathname;
            }
            
            console.log('[SW] Proxying:', event.request.url, '->', newUrl.href);
            
            event.respondWith(
                fetch(newUrl.href, {
                    method: event.request.method,
                    headers: event.request.headers,
                    mode: 'cors',
                    credentials: 'omit'
                }).then(function(response) {
                    console.log('[SW] Success:', newUrl.href, 'Status:', response.status);
                    return response;
                }).catch(function(error) {
                    console.error('[SW] Fetch error for', newUrl.href, error);
                    return new Response('Error loading resource from ' + SW_CONFIG.target.hostname + ':' + SW_CONFIG.target.port, {
                        status: 503,
                        statusText: 'Service Unavailable'
                    });
                })
            );
            return;
        }
    }
    
    // Все остальные запросы - обычная обработка
    event.respondWith(fetch(event.request));
});
