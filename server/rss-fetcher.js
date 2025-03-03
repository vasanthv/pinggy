const Parser = require("rss-parser");
const package = require("../package.json");
const utils = require("./utils");

const parser = new Parser({ "User-Agent": `Pinggy.com/${package.version}` });

/**
 * This function uses the `rss-parser` to fetch the RSS feed and converts them to a format that can be inserted into the Pinggy database
 * @param  {string} feedURL - URL of the RSS feed.
 * @return {object} A stripped down version of the feed & items from the RSS feed
 */
const rssFetcher = async (feedURL) => {
	try {
		const feed = await parser.parseURL(feedURL);

		const channel = {};
		channel["title"] = feed.title;
		channel["description"] = feed.description;
		channel["link"] = feed.link;
		channel["feedURL"] = feed.feedURL ?? feedURL;
		channel["imageURL"] = feed.image?.url;

		//Get only the first 100 elements of the rss feed
		const _items = feed.items.slice(0, 100);
		const items = _items.map((_item) => {
			const item = {};
			const content = _item["content:encoded"] ?? _item.content;
			const contentSnippet = _item["content:encodedSnippet"] ?? _item.contentSnippet;

			item["guid"] = typeof _item.guid === "string" ? _item.guid : (_item.id ?? _item.link);
			item["link"] = _item.link;
			item["title"] = utils.sanitizeText(
				(_item.title ?? _item.contentSnippet ?? `Untitled <${_item.link}>`).substr(0, 160)
			);
			item["content"] = content ? utils.sanitizeText(content) : undefined;
			item["textContent"] = contentSnippet;
			item["author"] = _item.author;
			item["comments"] = _item.comments;
			item["publishedOn"] = _item.isoDate ? new Date(_item.isoDate) : undefined;
			return item;
		});

		return { success: true, channel, items };
	} catch (err) {
		console.error(err);
		return { success: false, error: err.message };
	}
};

module.exports = rssFetcher;
