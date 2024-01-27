#!/usr/bin/env node

const puppeteer = require('puppeteer');
const express = require("express");
const request = require('request');
const app = express();
const port = 4000;

function get_stream_url(stream_page_url) {
    return new Promise(async (resolve, _) => {
        // create bowser instance to get the stream url
        const browser = await puppeteer.launch({ headless: "new" });
        const [page] = await browser.pages();
        await page.setRequestInterception(true); let found_url = false;

        page.on("request", (r) => {
            const url = r.url();
            if (url.includes(".m3u8") && !found_url) {
                found_url = true;

                resolve({ url: url, headers: r.headers() });
            }

            r.continue();
        });

        await page.goto(stream_page_url).catch((_) => { resolve({ url: "", headers: "" }); });
        await browser.close();

        resolve({ url: "", headers: "" });
    });
}

app.head("/", (_, res) => {
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Transfer-Encoding", "chunked");
    res.status(200).end();
});

app.get("/", async (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'video/mp4',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Transfer-Encoding': 'chunked'
    });

    // avoid multiple connections to same stremio app instance
    if (req.headers.connection) {
        if (req.headers.connection === "keep-alive") {
            res.end();
            return;
        }        
    }

    console.log("Received connection from new client.");
    const stream_page_url_b64 = req.query.target;
    const stream_page_url = Buffer.from(stream_page_url_b64, "base64").toString("utf-8");

    // get data for the stream and make sure it is valid
    const stream_data = await get_stream_url(stream_page_url);
    if (stream_data.url === "" || stream_data.headers === "") {
        res.end();
        return;
    }

    // stream loop
    let previousSegmentName = "";
    let connection_closed = false;
    (function streamIter() {
        // request m3u8 playlist file
        request({ url: stream_data.url, headers: stream_data.headers, method: "GET", timeout: 1000 }, (error, _, body) => {
            // somehting went wrong
            if (error) {
                console.log("An error occured!");
                return;
            }

            const segmentNames = body.split("\n").filter(line => line.endsWith(".ts"));
            if (segmentNames.length > 0 && previousSegmentName !== segmentNames[segmentNames.length - 1]) {
                // we need to request the new segment and stream it to the client
                previousSegmentName = segmentNames[segmentNames.length - 1];

                const segmentUrl = stream_data.url.split("hls/")[0] + "hls/" + segmentNames[segmentNames.length - 1];

                // make a request to the target server to get the TS segment
                request({ url: segmentUrl, headers: stream_data.headers, method: "GET" }, (e, _, __) => {
                    // something went wrong
                    if (e) {
                        console.log("An error occured!");
                    }

                    // go to next stream loop iteration or finish
                    if (!connection_closed) {
                        setTimeout(streamIter, 1000);
                    } else {
                        res.end();
                    }
                }).pipe(res, { end: false });
            } else {
                // go to next stream loop iteration or finish
                if (!connection_closed) {
                    setTimeout(streamIter, 1000);
                } else {
                    res.end();
                }
            }
        });
    })();

    req.on("close", () => {
        console.log("Client disconnected.");
        connection_closed = true;
    });
});

module.exports = {
    app,
    port
};
