/**
 * Service Worker Configuration
 * Настройки для проксирования запросов
 */

const SW_CONFIG = {
    // Целевой сервер для проксирования
    target: {
        hostname: 'localhost',
        protocol: 'http:',
        port: '3000'
    },
    
    // Исходный сервер (откуда идут запросы)
    source: {
        hostname: ['127.0.0.1', '1ottoland.com', 'localhost'],
        port: '8000'
    }
};



// const SW_CONFIG = {
//     // Целевой сервер для проксирования
//     target: {
//         hostname: 'ge-666.test.lottoland.com',
//         protocol: 'https:',
//         port: '443'
//     },
    
//     // Исходный сервер (откуда идут запросы)
//     source: {
//         hostname: ['127.0.0.1', '1ottoland.com', 'localhost'],
//         port: '8000'
//     }
// };