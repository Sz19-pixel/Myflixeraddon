module.exports = function handler(req, res) {
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
        ],
        idPrefixes: ['tt']  // ✅ التصحيح هنا
    };

    res.status(200).json(manifest);
};
