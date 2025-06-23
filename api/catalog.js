const { BASE_URL, makeRequest, parseSearchResults, parseUrlParams } = require('../lib/utils');

export default async function handler(req, res) {
    try {
        const { type, id } = req.query;
        const extraStr = req.query.extra || '';
        
        // Parse extra parameters
        const extra = {};
        if (extraStr) {
            const extraParams = parseUrlParams(`?${extraStr}`);
            Object.assign(extra, extraParams);
        }
        
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
        } else {
            return res.status(400).json({ error: 'Invalid catalog type' });
        }
        
        const response = await makeRequest(url);
        const results = parseSearchResults(response.data);
        
        const filteredResults = results.filter(item => item.type === type);
        
        res.status(200).json({
            metas: filteredResults
        });
        
    } catch (error) {
        console.error('Catalog error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch catalog',
            metas: [] 
        });
    }
} 
