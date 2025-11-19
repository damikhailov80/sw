/**
 * Service Worker Configuration
 * Settings for request proxying
 */

const SW_CONFIG = {
    // Target server for proxying
    target: {
        hostname: 'localhost',
        protocol: 'http:',
        port: '3000'
    },
    
    // Source server (where requests come from)
    source: {
        hostname: ['127.0.0.1', '1ottoland.com', 'localhost'],
        port: '8000'
    }
};



// const SW_CONFIG = {
//     // Target server for proxying
//     target: {
//         hostname: 'ge-666.test.lottoland.com',
//         protocol: 'https:',
//         port: '443'
//     },
    
//     // Source server (where requests come from)
//     source: {
//         hostname: ['127.0.0.1', '1ottoland.com', 'localhost'],
//         port: '8000'
//     }
// };