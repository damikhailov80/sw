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
            
            // If service worker is active but not controlling the page - reload
            if (registration.active && !navigator.serviceWorker.controller) {
                console.log('Service Worker active but not controlling, reloading page...');
                window.location.reload();
                return;
            }
            
            // Force check for updates
            registration.update().then(function() {
                console.log('Service Worker update check completed');
            });
            
            // Enable proxy mode after full page load
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
                console.log('Service Worker update found, new worker installing...');
                
                newWorker.addEventListener('statechange', function() {
                    console.log('Service Worker state changed to:', newWorker.state);
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        console.log('New Service Worker installed! Reload page to activate.');
                        // Automatically reload page to activate new SW
                        window.location.reload();
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
