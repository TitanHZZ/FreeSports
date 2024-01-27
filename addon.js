#!/usr/bin/env node

const { googleImage } = require("@bochilteam/scraper-images");
const { addonBuilder } = require("stremio-addon-sdk")
const request = require("request");
const cheerio = require("cheerio");

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

function arraysEqualIgnoreOrder(arr1, arr2) {
    // check if arrays have the same length
    if (arr1.length !== arr2.length) {
        return false;
    }

    // sort both arrays
    arr1.sort();
    arr2.sort();

    // compare sorted arrays element by element
    for (let i = 0; i < sortedArr1.length; i++) {
        if (sortedArr1[i] !== sortedArr2[i]) {
            return false;
        }
    }

    // all elements are equal
    return true;
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

// loop to keep streams_info always up to date
/*(async function updateStreamsMetadata() {
    const new_streams_info = await get_streams_data();
    const new_streams_names = Object.keys(new_streams_info);
    const old_streams_names = Object.keys(streams_info);

    // if arrays are equal, then there is nothing to do
    if (arraysEqualIgnoreOrder(old_streams_names, new_streams_names)) {
        console.log("Metadate is up to date.");
        setTimeout(updateStreamsMetadata, 10000);
    } else {
        console.log("Got new streams, updating metadata.");

        // get new metadata
        let new_streams_metadata = [];
        (new_streams_names).map((el) => {
            googleImage(`sports ${el} poster`).then((poster) => {
                console.log(poster[0]);
                streams_metadata.push({
                    id: el,
                    type: "sports",
                    name: el,
                    poster: poster.length ? poster[0] : ""
                });
            }).catch(() => {
                streams_metadata.push({
                    id: el,
                    type: "sports",
                    name: el,
                    poster: ""
                });
            });

            // update the actual arrays
            streams_info = new_streams_info;
            streams_metadata = new_streams_metadata;
        });
    }
})();*/

// TODO: hanlde the skip parameter in the extra section
// TODO: custom poster for each stream
builder.defineCatalogHandler(async (args) => {
    // make sure we only return a catalog for the 'sports' type
    if (args.type !== "sports") {
        return Promise.resolve({ metas: [] });
    }

    // console.log(args);
    // get all the data about the available streams and return it
    let result = [];
    // streams_info = await get_streams_data();
    // console.log(streams_info);
    /*Object.keys(streams_info).forEach((el) => {
        result.push({
            id: el,
            type: "sports",
            name: el,
            poster: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Big_buck_bunny_poster_big.jpg/220px-Big_buck_bunny_poster_big.jpg"
        });
    });
    await Promise.all(Object.keys(streams_info).map(async (el) => {
        const poster = await googleImage(`sports ${el} poster`).catch((e) => { console.log(e); });
        if (poster) {
            // console.log(poster[0]);
            result.push({
                id: el,
                type: "sports",
                name: el,
                poster: poster[0]
            });
        }
    }));*/

    return Promise.resolve({ metas: result });
});

builder.defineStreamHandler((args) => {
    // make sure we only return streams for the 'sports' type
    if (args.type !== "sports") {
        return Promise.resolve({ streams: [] });
    }

    let result = [];
    const stream_urls = streams_info[args.id];
    stream_urls.forEach((value) => {
        // get base64 of stream url
        const b64 = Buffer.from(value).toString("base64");
        result.push({ url: `http://127.0.0.1:4000?target=${b64}` });
    });

    // console.log(Buffer.from("Hello World").toString('base64'));
    // console.log(Buffer.from("SGVsbG8gV29ybGQ=", 'base64').toString('utf-8'));

    // console.log(args);
    // Docs: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/requests/defineStreamHandler.md
    // return no streams
    return Promise.resolve({ streams: result });
});

module.exports = builder.getInterface();
