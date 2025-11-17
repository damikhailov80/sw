/**
 * Service Worker Loader
 * This script registers the service worker as the very first resource
 * Include this script at the top of your HTML <head> for earliest execution
 */

(function() {
    'use strict';

    // Check if service workers are supported
    if ('serviceWorker' in navigator) {
        // Register immediately on script load (before DOMContentLoaded)
        const swPath = '/service-worker.js';
        
        navigator.serviceWorker.register(swPath, {
            scope: '/'
        })
        .then(function(registration) {
            console.log('Service Worker registered successfully:', registration.scope);
            
            // Включаем режим проксирования после полной загрузки страницы
            window.addEventListener('load', function() {
                if (navigator.serviceWorker.controller) {
                    navigator.serviceWorker.controller.postMessage({
                        type: 'ENABLE_REDIRECT'
                    });
                    console.log('Redirect mode enabled after page load');
                }
            });
            
            // Check for updates
            registration.addEventListener('updatefound', function() {
                const newWorker = registration.installing;
                console.log('Service Worker update found');
                
                newWorker.addEventListener('statechange', function() {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        console.log('New Service Worker available');
                    }
                });
            });
        })
        .catch(function(error) {
            console.error('Service Worker registration failed:', error);
        });

        // Handle controller change
        navigator.serviceWorker.addEventListener('controllerchange', function() {
            console.log('Service Worker controller changed');
        });
    } else {
        console.warn('Service Workers are not supported in this browser');
    }
})();
