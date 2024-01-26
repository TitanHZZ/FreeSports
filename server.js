#!/usr/bin/env node

// start stremio addon
const { serveHTTP, publishToCentral } = require("stremio-addon-sdk")
const addonInterface = require("./addon")
serveHTTP(addonInterface, { port: process.env.PORT || 49827 })

// when you've deployed your addon, un-comment this line
// publishToCentral("https://my-addon.awesome/manifest.json")
// for more information on deploying, see: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/deploying/README.md

// start HLS proxy
const { app, port } = require("./proxy");
app.listen(port, () => {
    console.log(`HLS proxy available at: http://127.0.0.1:${port}/`)
})
