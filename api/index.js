// Main entry point - redirects to manifest
module.exports = function handler(req, res) {
    res.status(200).json({
        message: 'MyFlixer Stremio Addon',
        manifest: `${req.headers.host ? `https://${req.headers.host}` : 'http://localhost:3000'}/manifest.json`,
        endpoints: {
            manifest: '/manifest.json',
            configure: '/configure',
            catalog: '/catalog/{type}/{id}',
            meta: '/meta/{type}/{id}',
            stream: '/stream/{type}/{id}'
        }
    });
};
