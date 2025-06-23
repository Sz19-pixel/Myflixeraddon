const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');

// Base URL with proxy
const BASE_URL = 'https://myflixer.phisherdesicinema.workers.dev/?url=https://myflixerz.to';

// Helper function to make requests
async function makeRequest(url, options = {}) {
    try {
        const response = await axios.get(url, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'Connection': 'keep-alive',
                ...options.headers
            },
            ...options
        });
        return response;
    } catch (error) {
        console.error('Request failed:', error.message);
        throw error;
    }
}

// Helper function to parse search results
function parseSearchResults(html) {
    const $ = cheerio.load(html);
    const results = [];
    
    $('.flw-item').each((i, element) => {
        const $el = $(element);
        const title = $el.find('h2.film-name > a').attr('title');
        const link = $el.find('h2.film-name > a').attr('href');
        const poster = $el.find('img.film-poster-img').attr('data-src') || $el.find('img.film-poster-img').attr('src');
        
        if (title && link && poster) {
            // Extract ID from link
            const id = link.split('/').pop();
            const type = link.includes('/movie/') ? 'movie' : 'series';
            
            results.push({
                id: `myflixer:${type}:${id}`,
                type: type,
                name: title,
                poster: poster,
                description: title
            });
        }
    });
    
    return results;
}

// Decryption helper (from original code)
function opensslKeyIv(password, salt, keyLen = 32, ivLen = 16) {
    let d = Buffer.alloc(0);
    let d_i = Buffer.alloc(0);
    
    while (d.length < keyLen + ivLen) {
        d_i = crypto.createHash('md5').update(Buffer.concat([d_i, Buffer.from(password), salt])).digest();
        d = Buffer.concat([d, d_i]);
    }
    
    return {
        key: d.subarray(0, keyLen),
        iv: d.subarray(keyLen, keyLen + ivLen)
    };
}

function decryptOpenSSL(encBase64, password) {
    try {
        const data = Buffer.from(encBase64, 'base64');
        
        if (!data.subarray(0, 8).equals(Buffer.from('Salted__'))) {
            throw new Error('Invalid encrypted data');
        }
        
        const salt = data.subarray(8, 16);
        const { key, iv } = opensslKeyIv(password, salt);
        
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(data.subarray(16));
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        
        return decrypted.toString();
    } catch (error) {
        console.error('Decryption failed:', error);
        return '';
    }
}

// Parse URL parameters
function parseUrlParams(url) {
    const params = {};
    const urlParts = url.split('?');
    if (urlParts.length > 1) {
        urlParts[1].split('&').forEach(param => {
            const [key, value] = param.split('=');
            params[decodeURIComponent(key)] = decodeURIComponent(value || '');
        });
    }
    return params;
}

module.exports = {
    BASE_URL,
    makeRequest,
    parseSearchResults,
    decryptOpenSSL,
    parseUrlParams
};
