const { addonBuilder } = require('stremio-addon-sdk');
const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');

// Addon manifest
const manifest = {
    id: 'myflixer.stremio.addon',
    version: '1.0.0',
    name: 'MyFlixer',
    description: 'Watch movies and series from MyFlixer',
    logo: 'https://myflixerz.to/images/group_1/theme_7/logo.png?v=0.1',
    resources: ['catalog', 'meta', 'stream'],
    types: ['movie', 'series'],
    catalogs: [
        {
            type: 'movie',
            id: 'myflixer-movies',
            name: 'MyFlixer Movies',
            extra: [
                { name: 'skip', isRequired: false },
                { name: 'search', isRequired: false }
            ]
        },
        {
            type: 'series',
            id: 'myflixer-series',
            name: 'MyFlixer TV Series',
            extra: [
                { name: 'skip', isRequired: false },
                { name: 'search', isRequired: false }
            ]
        }
    ]
};

const builder = new addonBuilder(manifest);

// Base URL with proxy
const BASE_URL = 'https://myflixer.phisherdesicinema.workers.dev/?url=https://myflixerz.to';

// Helper function to make requests
async function makeRequest(url, options = {}) {
    try {
        const response = await axios.get(url, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
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
        const poster = $el.find('img.film-poster-img').attr('data-src');
        
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

// Catalog handler
builder.defineCatalogHandler(async ({ type, id, extra }) => {
    const skip = parseInt(extra.skip || 0);
    const search = extra.search;
    
    let url;
    if (search) {
        url = `${BASE_URL}/search/${search.replace(/\s+/g, '-')}`;
    } else if (type === 'movie') {
        const page = Math.floor(skip / 20) + 1;
        url = `${BASE_URL}/movie?page=${page}`;
    } else if (type === 'series') {
        const page = Math.floor(skip / 20) + 1;
        url = `${BASE_URL}/tv-show?page=${page}`;
    }
    
    try {
        const response = await makeRequest(url);
        const results = parseSearchResults(response.data);
        
        return {
            metas: results.filter(item => item.type === type)
        };
    } catch (error) {
        console.error('Catalog error:', error);
        return { metas: [] };
    }
});

// Meta handler
builder.defineMetaHandler(async ({ type, id }) => {
    const [, contentType, contentId] = id.split(':');
    const url = `${BASE_URL}/${contentType}/${contentId}`;
    
    try {
        const response = await makeRequest(url);
        const $ = cheerio.load(response.data);
        
        const name = $('.detail_page-infor h2.heading-name > a').text();
        const poster = $('.detail_page-infor .film-poster img').attr('src');
        const description = $('.detail_page-infor .description').text();
        const imdbRating = $('.detail_page-infor .btn-imdb').text()
            .replace('N/A', '')
            .replace('IMDB: ', '');
        const trailer = $('#iframe-trailer').attr('data-src');
        
        const meta = {
            id: id,
            type: type,
            name: name,
            poster: poster,
            description: description,
            imdbRating: imdbRating || undefined,
            trailer: trailer ? [{ source: trailer, type: 'trailer' }] : undefined
        };
        
        // For series, get episodes
        if (type === 'series') {
            const dataId = $('.detail_page-watch').attr('data-id');
            if (dataId) {
                try {
                    const seasonsResponse = await makeRequest(`${BASE_URL}/ajax/season/list/${dataId}`);
                    const $seasons = cheerio.load(seasonsResponse.data);
                    const videos = [];
                    
                    for (let seasonEl of $seasons('a.ss-item').toArray()) {
                        const seasonId = $(seasonEl).attr('data-id');
                        const seasonNum = $(seasonEl).text().replace('Season ', '');
                        
                        const episodesResponse = await makeRequest(`${BASE_URL}/ajax/season/episodes/${seasonId}`);
                        const $episodes = cheerio.load(episodesResponse.data);
                        
                        $episodes('a.eps-item').each((i, epEl) => {
                            const epTitle = $(epEl).attr('title');
                            const epId = $(epEl).attr('data-id');
                            const match = epTitle.match(/Eps (\d+): (.+)/);
                            
                            if (match) {
                                const [, epNum, epName] = match;
                                videos.push({
                                    id: `${id}:${seasonNum}:${epNum}`,
                                    title: epName,
                                    season: parseInt(seasonNum),
                                    episode: parseInt(epNum),
                                    overview: epName
                                });
                            }
                        });
                    }
                    
                    meta.videos = videos;
                } catch (error) {
                    console.error('Error fetching episodes:', error);
                }
            }
        }
        
        return { meta };
    } catch (error) {
        console.error('Meta error:', error);
        throw new Error('Content not found');
    }
});

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

// Stream handler
builder.defineStreamHandler(async ({ type, id }) => {
    const parts = id.split(':');
    const contentType = parts[1];
    const contentId = parts[2];
    
    try {
        let dataUrl;
        
        if (type === 'movie') {
            dataUrl = `${BASE_URL}/ajax/episode/list/${contentId}`;
        } else {
            // For series episodes
            const seasonNum = parts[3];
            const epNum = parts[4];
            
            // Get episode data ID
            const seriesUrl = `${BASE_URL}/${contentType}/${contentId}`;
            const seriesResponse = await makeRequest(seriesUrl);
            const $series = cheerio.load(seriesResponse.data);
            const seriesDataId = $series('.detail_page-watch').attr('data-id');
            
            const seasonsResponse = await makeRequest(`${BASE_URL}/ajax/season/list/${seriesDataId}`);
            const $seasons = cheerio.load(seasonsResponse.data);
            
            let episodeDataId = null;
            for (let seasonEl of $seasons('a.ss-item').toArray()) {
                const seasonId = $(seasonEl).attr('data-id');
                const sNum = $(seasonEl).text().replace('Season ', '');
                
                if (sNum === seasonNum) {
                    const episodesResponse = await makeRequest(`${BASE_URL}/ajax/season/episodes/${seasonId}`);
                    const $episodes = cheerio.load(episodesResponse.data);
                    
                    $episodes('a.eps-item').each((i, epEl) => {
                        const epTitle = $(epEl).attr('title');
                        const match = epTitle.match(/Eps (\d+):/);
                        if (match && match[1] === epNum) {
                            episodeDataId = $(epEl).attr('data-id');
                            return false; // break
                        }
                    });
                    break;
                }
            }
            
            if (!episodeDataId) {
                throw new Error('Episode not found');
            }
            
            dataUrl = `${BASE_URL}/ajax/episode/servers/${episodeDataId}`;
        }
        
        const serversResponse = await makeRequest(dataUrl);
        const $servers = cheerio.load(serversResponse.data);
        const streams = [];
        
        for (let serverEl of $servers('a.link-item').toArray()) {
            const linkId = $(serverEl).attr('data-linkid') || $(serverEl).attr('data-id');
            
            try {
                const sourceResponse = await makeRequest(`${BASE_URL}/ajax/episode/sources/${linkId}`);
                const sourceData = sourceResponse.data;
                
                if (sourceData.link) {
                    // Handle Videostr extractor
                    if (sourceData.link.includes('videostr.net')) {
                        try {
                            const videoId = sourceData.link.split('/').pop().split('?')[0];
                            const apiUrl = `https://videostr.net/embed-1/v2/e-1/getSources?id=${videoId}`;
                            
                            const videoResponse = await makeRequest(apiUrl, {
                                headers: {
                                    'Accept': '*/*',
                                    'X-Requested-With': 'XMLHttpRequest',
                                    'Referer': 'https://videostr.net'
                                }
                            });
                            
                            const videoData = videoResponse.data;
                            
                            // Get decryption key
                            const keyResponse = await makeRequest('https://raw.githubusercontent.com/yogesh-hacker/MegacloudKeys/refs/heads/main/keys.json');
                            const keys = keyResponse.data;
                            
                            if (keys.vidstr && videoData.sources) {
                                const decryptedJson = decryptOpenSSL(videoData.sources, keys.vidstr);
                                const sources = JSON.parse(decryptedJson);
                                
                                for (let source of sources) {
                                    if (source.file && source.type === 'hls') {
                                        streams.push({
                                            name: 'MyFlixer',
                                            title: 'MyFlixer - HLS',
                                            url: source.file,
                                            behaviorHints: {
                                                bingeGroup: 'myflixer',
                                                notWebReady: true
                                            }
                                        });
                                    }
                                }
                                
                                // Add subtitles if available
                                if (videoData.tracks) {
                                    const subtitles = videoData.tracks
                                        .filter(track => track.kind === 'captions' || track.kind === 'subtitles')
                                        .map(track => ({
                                            url: track.file,
                                            lang: track.label
                                        }));
                                    
                                    if (subtitles.length > 0 && streams.length > 0) {
                                        streams[streams.length - 1].subtitles = subtitles;
                                    }
                                }
                            }
                        } catch (error) {
                            console.error('Videostr extraction error:', error);
                        }
                    } else {
                        // Direct link
                        streams.push({
                            name: 'MyFlixer',
                            title: 'MyFlixer - Direct',
                            url: sourceData.link,
                            behaviorHints: {
                                bingeGroup: 'myflixer'
                            }
                        });
                    }
                }
            } catch (error) {
                console.error('Server extraction error:', error);
            }
        }
        
        return { streams };
    } catch (error) {
        console.error('Stream error:', error);
        return { streams: [] };
    }
});

module.exports = builder.getInterface();
