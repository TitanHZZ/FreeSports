const { googleImage } = require("@bochilteam/scraper-images");
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

(async () => {
    let result = [];
    const streams_info = await get_streams_data();
    /*Object.keys(streams_info).forEach((el) => {
        result.push({
            id: el,
            type: "sports",
            name: el,
            poster: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Big_buck_bunny_poster_big.jpg/220px-Big_buck_bunny_poster_big.jpg"
        });
    });*/

    await Promise.all(Object.keys(streams_info).map(async (el) => {
        const poster = await googleImage(`sports ${el} poster`).catch((e) => { console.log(e); });
        if (poster) {
            console.log(poster[0]);
            result.push({
                id: el,
                type: "sports",
                name: el,
                poster: poster[0]
            });
        }
    }));

    console.log(result);
})();
