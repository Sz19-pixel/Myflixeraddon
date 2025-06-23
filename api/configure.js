// Configuration page endpoint
module.exports = function handler(req, res) {
    const baseUrl = req.headers.host ? `https://${req.headers.host}` : 'http://localhost:3000';
    
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>MyFlixer Stremio Addon</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                max-width: 600px;
                margin: 50px auto;
                padding: 20px;
                background: #1a1a1a;
                color: white;
            }
            .logo {
                text-align: center;
                margin-bottom: 30px;
            }
            .logo img {
                max-width: 200px;
                border-radius: 10px;
            }
            .install-button {
                display: block;
                width: 100%;
                padding: 15px;
                margin: 20px 0;
                background: #7b2cbf;
                color: white;
                text-decoration: none;
                text-align: center;
                border-radius: 8px;
                font-size: 18px;
                font-weight: bold;
            }
            .install-button:hover {
                background: #9d50dd;
            }
            .info {
                background: #2a2a2a;
                padding: 20px;
                border-radius: 8px;
                margin: 20px 0;
            }
            .code {
                background: #333;
                padding: 10px;
                border-radius: 4px;
                font-family: monospace;
                word-break: break-all;
            }
        </style>
    </head>
    <body>
        <div class="logo">
            <img src="https://myflixerz.to/images/group_1/theme_7/logo.png?v=0.1" alt="MyFlixer">
            <h1>MyFlixer Stremio Addon</h1>
        </div>
        
        <div class="info">
            <h3>📺 Features:</h3>
            <ul>
                <li>🎬 Latest Movies</li>
                <li>📺 TV Series with Episodes</li>
                <li>🔍 Search Functionality</li>
                <li>🎥 Multiple Stream Sources</li>
                <li>📝 Subtitle Support</li>
            </ul>
        </div>
        
        <a href="stremio://${baseUrl}/manifest.json" class="install-button">
            📱 Install in Stremio App
        </a>
        
        <div class="info">
            <h3>💻 Manual Installation:</h3>
            <p>1. Open Stremio</p>
            <p>2. Go to Add-ons (puzzle piece icon)</p>
            <p>3. Click "Add-on repository URL"</p>
            <p>4. Paste this URL:</p>
            <div class="code">${baseUrl}/manifest.json</div>
            <p>5. Click "Install"</p>
        </div>
        
        <div class="info">
            <h3>ℹ️ Information:</h3>
            <p><strong>Version:</strong> 1.0.0</p>
            <p><strong>Content:</strong> Movies & TV Series</p>
            <p><strong>Language:</strong> English</p>
            <p><strong>Status:</strong> Active</p>
        </div>
    </body>
    </html>
    `;
    
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);
};
