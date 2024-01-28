#!/usr/bin/env node

const { googleImage } = require("@bochilteam/scraper-images");
const { addonBuilder } = require("stremio-addon-sdk")
const request = require("request");
const cheerio = require("cheerio");

// if a custom port is set we are running in the server or else, localhost
const hls_proxy_target = process.env.PORT ? "https://3c7d0158c479-freesports.baby-beamup.club/proxy" : "http://localhost:6000";

function get_streams_data() {
    const url = "https://hd.cricfree.io/";
    return new Promise((resolve, _) => {
        request({ url: url }, (error, _, body) => {
            if (error) {
                console.log("An error occured.");
                resolve({});
                return;
            }

            // load the body (html) with cheerio
            const $ = cheerio.load(body);

            // get all the tables (they contain the urls to the streams and their names)
            const streams_data = $("article table tbody");
            let streams_data_dict = {};

            // get the names of all current streams
            let streams_names = [];
            $(streams_data).find("tr.info-open td.event span[itemprop='headline']").each((_, element) => {
                const new_name = $(element).text().trim();
                streams_names.push(new_name);
                streams_data_dict[new_name] = [];
            });

            // get the urls available for each stream to build a dictionary
            $(streams_data).find("tr.info th.play").each((index, element) => {
                $(element).find("a.btn").each((_, e) => {
                    streams_data_dict[streams_names[index]].push($(e).attr("href"));
                });
            });

            // remove streams with no links
            streams_data_dict = Object.keys(streams_data_dict).reduce((filtered, key) => {
                if (streams_data_dict[key].length > 0) {
                    filtered[key] = streams_data_dict[key];
                }

                return filtered;
            }, {});

            resolve(streams_data_dict);
        });
    });
}

// Docs: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/responses/manifest.md
const manifest = {
    "id": "community.FreeSports",
    "version": "0.0.1",
    "catalogs": [{
        "type": "sports",
        "id": "top"
    }],
    "resources": [
        "catalog",
        "stream"
    ],
    "types": [
        "sports"
    ],
    "name": "FreeSports",
    "description": "Watch your favourite sports."
}
const builder = new addonBuilder(manifest)
let streams_info = []; // used to store the names and stream page urls
let streams_metadata = []; // used to store the metadata for the streams

// TODO: sort streams_info accordingly to the order in the website
// loop to keep streams_info always up to date
(async function updateStreamsMetadata() {
    const new_streams_info = await get_streams_data();
    const new_streams_names = Object.keys(new_streams_info);

    console.log("Got new streams, updating metadata.");
    let new_streams_metadata = [];
    await Promise.all((new_streams_names).map(async (name) => {
        // get the old stream metadata with the specific name
        const stream_md = streams_metadata.filter((md) => md.name === name);

        // we need to get new metadata
        if (stream_md.length === 0 || stream_md[0].poster === "") {
            const poster = await googleImage(`sports ${name} poster`).catch((_) => { });
            /*if (poster) {
                console.log(poster[0]);
            }*/

            new_streams_metadata.push({
                id: name,
                type: "sports",
                name: name,
                poster: poster ? poster[0] : ""
            });
        } else {
            // take the new metadata from the old one
            new_streams_metadata.push(stream_md[0]);
        }
    }));

    // update the actual arrays
    streams_info = new_streams_info;
    streams_metadata = new_streams_metadata;

    console.log("Finished updating all metadata, starting new update cycle.");
    setTimeout(updateStreamsMetadata, 60000);
})();

// TODO: handle the skip parameter in the extra section
builder.defineCatalogHandler(async (args) => {
    // make sure we only return a catalog for the 'sports' type
    if (args.type !== "sports") {
        return Promise.resolve({ metas: [] });
    }

    return Promise.resolve({ metas: streams_metadata });
});

builder.defineStreamHandler((args) => {
    // make sure we only return streams for the 'sports' type
    if (args.type !== "sports") {
        return Promise.resolve({ streams: [] });
    }

    let result = [];
    const stream_urls = streams_info[args.id];
    if (stream_urls) {
        stream_urls.forEach((value) => {
            // get base64 of stream url
            const b64 = Buffer.from(value).toString("base64");
            result.push({ url: `${hls_proxy_target}?target=${b64}` });
        });
    }

    // return no streams
    return Promise.resolve({ streams: result });
});

module.exports = builder.getInterface();
