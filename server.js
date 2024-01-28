#!/usr/bin/env node

//// START STREMIO ADDON ////
const addon_port = 6000;
const { serveHTTP, publishToCentral } = require("stremio-addon-sdk");
const addonInterface = require("./addon");
serveHTTP(addonInterface, { port: addon_port });

// when you've deployed your addon, un-comment this line
// publishToCentral("https://my-addon.awesome/manifest.json")
// for more information on deploying, see: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/deploying/README.md

//// START HLS PROXY ////
const proxy_port = 7000;
const app = require("./proxy");
app.listen(proxy_port, () => {
    console.log(`Started HLS proxy on ${proxy_port}`);
});

//// START MAIN SERVICE THAT WILL ACT AS A PROXY TO THE ADDON AND HLS PROXY ////
const { createProxyMiddleware } = require("http-proxy-middleware");
const express = require("express");

const service = express();
const service_port = process.env.PORT || 8000;

service.use(createProxyMiddleware((pathname, _) => !pathname.match("^/proxy"), {
    target: "http://localhost:4000",
    changeOrigin: true,
}));

service.use("/proxy", createProxyMiddleware((pathname, _) => pathname.match("^/proxy"), {
    target: "http://localhost:5000",
    changeOrigin: true,
    pathRewrite: {
        ["^/proxy"]: "/"
    }
}));

// start the server
service.listen(service_port, () => {
    console.log(`Service proxy is running at port ${service_port}`);
});
