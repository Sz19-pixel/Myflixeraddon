const cheerio = require('cheerio');
const { BASE_URL, makeRequest, decryptOpenSSL } = require('../lib/utils');

export default async function handler(req, res) {
    try {
        const { type, id } = req.query;
        
        if (!id || !type) {
            return res.status(400).json({ error: 'Missing type or id parameter' });
        }
        
        const parts = id.split(':');
        const contentType = parts[1];
        const contentId = parts[2];
        
        let dataUrl;
        let episodeDataId = null;
        
        if (type === 'movie') {
            // For movies, we need to get the data-id first
            const movieUrl = `${BASE_URL}/${contentType}/${contentId}`;
            const movieResponse = await makeRequest(movieUrl);
            const $movie = cheerio.load(movieResponse.data);
            const movieDataId = $movie('.detail_page-watch').attr('data-id');
            
            if (!movieDataId) {
                return res.status(404).json({ error: 'Movie data not found', streams: [] });
            }
            
            dataUrl = `${BASE_URL}/ajax/episode/list/${movieDataId}`;
        } else {
            // For series episodes
            const seasonNum = parts[3];
            const epNum = parts[4];
            
            // Get episode data ID
            const seriesUrl = `${BASE_URL}/${contentType}/${contentId}`;
            const seriesResponse = await makeRequest(seriesUrl);
            const $series = cheerio.load(seriesResponse.data);
            const seriesDataId = $series('.detail_page-watch').attr('data-id');
            
            if (!seriesDataId) {
                return res.status(404).json({ error: 'Series data not found', streams: [] });
            }
            
            const seasonsResponse = await makeRequest(`${BASE_URL}/ajax/season/list/${seriesDataId}`);
            const $seasons = cheerio.load(seasonsResponse.data);
            
            for (let seasonEl of $seasons('a.ss-item').toArray()) {
                const seasonId = $(seasonEl).attr('data-id');
                const sNum = $(seasonEl).text().replace('Season ', '').replace('Series', '').trim();
                
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
                return res.status(404).json({ error: 'Episode not found', streams: [] });
            }
            
            dataUrl = `${BASE_URL}/ajax/episode/servers/${episodeDataId}`;
        }
        
        const serversResponse = await makeRequest(dataUrl);
        const $servers = cheerio.load(serversResponse.data);
        const streams = [];
        
        const serverElements = $servers('a.link-item').toArray();
        
        for (let serverEl of serverElements) {
            const linkId = $(serverEl).attr('data-linkid') || $(serverEl).attr('data-id');
            
            if (!linkId) continue;
            
            try {
                const sourceResponse = await makeRequest(`${BASE_URL}/ajax/episode/sources/${linkId}`);
                const sourceData = sourceResponse.data;
                
                if (sourceData && sourceData.link) {
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
                            
                            if (videoData && videoData.sources) {
                                // Get decryption key
                                try {
                                    const keyResponse = await makeRequest('https://raw.githubusercontent.com/yogesh-hacker/MegacloudKeys/refs/heads/main/keys.json');
                                    const keys = keyResponse.data;
                                    
                                    if (keys.vidstr) {
                                        const decryptedJson = decryptOpenSSL(videoData.sources, keys.vidstr);
                                        
                                        if (decryptedJson) {
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
                                    }
                                } catch (keyError) {
                                    console.error('Key fetch error:', keyError);
                                }
                            }
                        } catch (videoError) {
                            console.error('Videostr extraction error:', videoError);
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
            } catch (serverError) {
                console.error('Server extraction error:', serverError);
            }
        }
        
        res.status(200).json({ streams });
        
    } catch (error) {
        console.error('Stream error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch streams',
            streams: [] 
        });
    }
}
