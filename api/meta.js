const cheerio = require('cheerio');
const { BASE_URL, makeRequest } = require('../lib/utils');

module.exports = async function handler(req, res) {
    try {
        const { type, id } = req.query;
        
        if (!id || !type) {
            return res.status(400).json({ error: 'Missing type or id parameter' });
        }
        
        const [, contentType, contentId] = id.split(':');
        const url = `${BASE_URL}/${contentType}/${contentId}`;
        
        const response = await makeRequest(url);
        const $ = cheerio.load(response.data);
        
        const name = $('.detail_page-infor h2.heading-name > a').text().trim();
        const poster = $('.detail_page-infor .film-poster img').attr('src');
        const description = $('.detail_page-infor .description').text().trim();
        const imdbRating = $('.detail_page-infor .btn-imdb').text()
            .replace('N/A', '')
            .replace('IMDB: ', '')
            .trim();
        const trailer = $('#iframe-trailer').attr('data-src');
        
        if (!name) {
            return res.status(404).json({ error: 'Content not found' });
        }
        
        const meta = {
            id: id,
            type: type,
            name: name,
            poster: poster || undefined,
            description: description || undefined,
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
                    
                    const seasonElements = $seasons('a.ss-item').toArray();
                    
                    for (let seasonEl of seasonElements) {
                        const seasonId = $(seasonEl).attr('data-id');
                        const seasonText = $(seasonEl).text().trim();
                        const seasonNum = seasonText.replace('Season ', '').replace('Series', '').trim();
                        
                        try {
                            const episodesResponse = await makeRequest(`${BASE_URL}/ajax/season/episodes/${seasonId}`);
                            const $episodes = cheerio.load(episodesResponse.data);
                            
                            $episodes('a.eps-item').each((i, epEl) => {
                                const epTitle = $(epEl).attr('title');
                                const epId = $(epEl).attr('data-id');
                                
                                if (epTitle && epId) {
                                    const match = epTitle.match(/Eps (\d+): (.+)/);
                                    
                                    if (match) {
                                        const [, epNum, epName] = match;
                                        videos.push({
                                            id: `${id}:${seasonNum}:${epNum}`,
                                            title: epName.trim(),
                                            season: parseInt(seasonNum) || 1,
                                            episode: parseInt(epNum),
                                            overview: epName.trim()
                                        });
                                    }
                                }
                            });
                        } catch (error) {
                            console.error(`Error fetching episodes for season ${seasonNum}:`, error);
                        }
                    }
                    
                    if (videos.length > 0) {
                        meta.videos = videos.sort((a, b) => {
                            if (a.season !== b.season) return a.season - b.season;
                            return a.episode - b.episode;
                        });
                    }
                } catch (error) {
                    console.error('Error fetching episodes:', error);
                }
            }
        }
        
        res.status(200).json({ meta });
        
    } catch (error) {
        console.error('Meta error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch metadata'
        });
    }
};
