/**
 * Service Worker Configuration
 * Настройки для проксирования запросов
 */

const SW_CONFIG = {
    // Целевой сервер для проксирования
    target: {
        hostname: 'localhost',
        port: '3000'
    },
    
    // Исходный сервер (откуда идут запросы)
    source: {
        hostname: '127.0.0.1',
        port: '8000'
    }
};
