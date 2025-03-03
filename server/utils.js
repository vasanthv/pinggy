const { Readability, isProbablyReaderable } = require("@mozilla/readability");
const rateLimiter = require("express-rate-limit");
const domPurify = require("isomorphic-dompurify");
const slowDown = require("express-slow-down");
const { JSDOM } = require("jsdom");
const crypto = require("crypto");
const { URL } = require("url");
const axios = require("axios");

const config = require("./config");
const { Users } = require("./model").getInstance();

const getValidUsername = (username) => {
	if (!username) return httpError(400, "Invalid username");
	if (config.INVALID_HANDLES.includes(username.toLowerCase())) return httpError(400, "Invalid username");
	const usernameRegex = /^([a-zA-Z0-9]){1,18}$/;
	if (!usernameRegex.test(username)) return httpError(400, "Invalid username. Max. 18 alphanumeric chars.");
	return username.toLowerCase();
};

const getValidListName = (list) => {
	if (!list) return list;
	return list.replace(/\W+/g, "-").replace(/-$/, "").toLowerCase();
};

/**
 * Returns the email if valid else throws an error using httpError function
 * @param  {string} email - Email to be validated
 * @return {string} Valid email
 */
const getValidEmail = (email) => {
	if (!email) return httpError(400, "Empty email");
	if (!isValidEmail(email)) return httpError(400, "Invalid email");
	return email;
};

/**
 * Returns the url if valid else throws an error using httpError function
 * @param  {string} url - URL to be validated
 * @return {string} Valid URL
 */
const getValidURL = (url) => {
	if (!url) return httpError(400, "Empty URL");
	if (!isValidUrl(url) || url.length > 2000) return httpError(400, "Invalid URL");
	return url;
};

/**
 * Return true if the given email is a valid one, else returns false.
 * @param  {string} email - Emaill address to be validated
 * @return {boolean}
 */
const isValidEmail = (email) => {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

/**
 * Return true if the given url is a valid one, else returns false.
 * @param  {string} url - URL to be validated
 * @return {boolean}
 */
const isValidUrl = (url) => {
	try {
		const _url = new URL(url);
		return ["http:", "https:"].includes(_url.protocol) ? Boolean(_url) : false;
	} catch (e) {
		console.error(e);
		return false;
	}
};

/**
 * Return a sanitized text to save and render in the UI
 * @param  {string} text
 * @return {string}
 */
const sanitizeText = (content) => {
	return domPurify.sanitize(content, {
		FORBID_TAGS: ["input", "script", "style", "button", "select", "textarea"],
		FORBID_ATTR: ["style", "onclick", "onhover", "onload"],
	});
};

/**
 * Returns a sha256 hashed string, adds an optional secret that can be configured in config.js
 * @param  {string} str - string to be hashed
 * @return {string} Hashed string
 */
const hashString = (str) => {
	return crypto
		.createHash("sha256")
		.update(str + config.SECRET)
		.digest("hex");
};

/**
 * Returns a sha256 hashed string, adds an optional secret that can be configured in config.js
 * @param  {string} password - password string to be hashed
 * @return {string} Hashed password
 */
const getValidPassword = (password) => {
	if (!password) return httpError(400, "Invalid password");
	if (password.length < 8) return httpError(400, "Password length should be atleast 8 characters");
	return hashString(password);
};
/**
 * This is an Express js middleware to attach the request user to req.user path.
 * @param  {object}   req  - Express.js Request object. https://expressjs.com/en/5x/api.html#req
 * @param  {[type]}   res  - Express.js Response object. https://expressjs.com/en/5x/api.html#res
 * @param  {Function} next - Express.js next middleware function https://expressjs.com/en/guide/writing-middleware.html
 * @return {null}
 */
const attachUsertoRequest = async (req, res, next) => {
	if (req.session.token) {
		const token = req.session.token;
		req["token"] = token;
		req["user"] = await Users.findOne({ "devices.token": token });
	}
	next();
};

/**
 * This is an Express js middleware to attach the request user to req.user path from API key.
 * @param  {object}   req  - Express.js Request object. https://expressjs.com/en/5x/api.html#req
 * @param  {[type]}   res  - Express.js Response object. https://expressjs.com/en/5x/api.html#res
 * @param  {Function} next - Express.js next middleware function https://expressjs.com/en/guide/writing-middleware.html
 * @return {null}
 */

const attachUsertoRequestFromAPIKey = async (req, res, next) => {
	if (req.headers["x-api-key"] || req.headers["X-API-KEY"]) {
		const apiKey = req.headers["x-api-key"] || req.headers["X-API-KEY"];
		req["user"] = await Users.findOne({ apiKeys: apiKey });
	}
	next();
};

/**
 * This is an Express js middleware to check if the request is authenticated or not.
 * Calls next when authenticated.
 * Responds a JSON error response if not authenticated.
 * @param  {object}   req  - Express.js Request object. https://expressjs.com/en/5x/api.html#req
 * @param  {[type]}   res  - Express.js Response object. https://expressjs.com/en/5x/api.html#res
 * @param  {Function} next - Express.js next middleware function https://expressjs.com/en/guide/writing-middleware.html
 * @return {null}
 */
const isUserAuthed = (req, res, next) => {
	if (req.user) return next();
	res.status(401).json({ message: "Please log in" });
};

/**
 * This is an Express js middleware to validate if the request holds a valid CSRF token
 * Calls next when the request holds a valid CSRF token
 * Responds a JSON error response if the request does not hold a valid CSRF token
 * @param  {object}   req  - Express.js Request object. https://expressjs.com/en/5x/api.html#req
 * @param  {[type]}   res  - Express.js Response object. https://expressjs.com/en/5x/api.html#res
 * @param  {Function} next - Express.js next middleware function https://expressjs.com/en/guide/writing-middleware.html
 * @return {null}
 */
const csrfValidator = async (req, res, next) => {
	if (config.DISABLE_CSRF || req.method === "GET" || req.headers["x-api-key"] || req.headers["X-API-KEY"]) {
		return next();
	}
	if (!req.session.csrfs?.some((csrf) => csrf.token === req.headers["x-csrf-token"])) {
		return res.status(400).json({ message: "Page expired. Please refresh and try again" });
	}
	next();
};

/**
 * This is an Express js middleware to rate limit request. Uses `express-rate-limit` package
 * @param  {object}   req  - Express.js Request object. https://expressjs.com/en/5x/api.html#req
 * @param  {[type]}   res  - Express.js Response object. https://expressjs.com/en/5x/api.html#res
 * @param  {Function} next - Express.js next middleware function https://expressjs.com/en/guide/writing-middleware.html
 * @return {null}
 */
const rateLimit = (options) => {
	return rateLimiter({
		max: 50,
		...options,
		windowMs: (options?.windowMs || 5) * 60 * 1000, // in minutes
		handler: (req, res) =>
			res.status(429).json({ message: `Too many requests. Try again after ${options?.windowMs || 5} mins` }),
	});
};

/**
 * This is an Express js middleware to speed limit requests. Uses `express-slow-down` package
 * @param  {object}   req  - Express.js Request object. https://expressjs.com/en/5x/api.html#req
 * @param  {[type]}   res  - Express.js Response object. https://expressjs.com/en/5x/api.html#res
 * @param  {Function} next - Express.js next middleware function https://expressjs.com/en/guide/writing-middleware.html
 * @return {null}
 */
const speedLimiter = slowDown({
	windowMs: 15 * 60 * 1000, // 15 minutes
	delayAfter: 20, // allow 100 requests per 15 minutes, then...
	delayMs: () => 500, // begin adding 500ms of delay per request above 20
});

/**
 * A database helper function to check if the given email address is registered or not.
 * @param  {string} email - Email address to be validated.
 * @param  {string} currentUserId - Current logged in users' id
 * @return {Promise<string>} A promise which resolves to email
 */
const isNewUsername = async (username, currentChannelId) => {
	let query = { username: { $regex: new RegExp(`^${username}$`, "i") } };
	if (currentChannelId) {
		query["_id"] = { $ne: currentChannelId };
	}

	const existingUsername = await Users.findOne(query).select("username").exec();
	return existingUsername ? httpError(400, "Username already taken") : username;
};

/**
 * A database helper function to check if the given email address is registered or not.
 * @param  {string} email - Email address to be validated.
 * @param  {string} currentUserId - Current logged in users' id
 * @return {Promise<string>} A promise which resolves to email
 */
const isNewEmail = async (email, currentUserId) => {
	let query = { email: { $regex: new RegExp(`^${email}$`, "i") } };
	if (currentUserId) {
		query["_id"] = { $ne: currentUserId };
	}

	const existingEmail = await Users.findOne(query).select("email").exec();
	return existingEmail ? httpError(400, "Email already taken") : email;
};

/**
 * A database helper function to fetch user by email
 * @param  {string} email - Email address to be validated.
 * @return {Promise<User>} A promise which resolves to user object
 */
const getUserByEmail = async (email) => {
	let query = { email: { $regex: new RegExp(`^${email}$`, "i") } };

	return await Users.findOne(query).exec();
};

/**
 * Finds & returns the RSS/ATOM feed url from the website.
 * @param  {string} url - URL from which the RSS feed URL is to be fetched.
 * @return {Promise<string | null>} - RSS/ATOM feed url if present
 */
const findFeedURL = async (url) => {
	const urlContents = await getURLContents(url);
	const dom = new JSDOM(urlContents);

	const feedTag =
		dom.window.document.querySelector("link[type='application/rss+xml']") ??
		dom.window.document.querySelector("link[type='application/atom+xml']");

	if (!feedTag) return null;
	let feedURL = feedTag.href;
	if (!feedURL.startsWith("http")) {
		feedURL = new URL(feedURL, url).href;
	}

	return feedURL;
};

/**
 * Fetch the readable content from a URL
 * @param  {string} url - URL from which the RSS feed URL is to be fetched.
 * @return {Promise<{title:string; content?: string; textContent?: string}>} - Readable content from the URL
 */
const fetchContentFromURL = async (url) => {
	const urlContents = await getURLContents(url);
	const dom = new JSDOM(urlContents);
	const docTitle = (dom.window.document.title ?? url).substr(0, 160);

	if (!isProbablyReaderable(dom.window.document)) {
		return { title: docTitle };
	}

	let reader = new Readability(dom.window.document);
	let article = reader.parse();

	const { title, content, textContent } = article;
	return { title: title ?? docTitle, content: content ? sanitizeText(content) : undefined, textContent };
};

/**
 * Returns the contents of an URL
 * @param  {string} url - URL to be fetched
 * @return {} Contents of the URL.
 */
const getURLContents = async (url) => {
	try {
		const { data, status, statusText } = await axios(url);
		if (statusText !== "OK") return httpError(400, `Unable to fetch feed. Error code: ${status}`);
		return data;
	} catch (err) {
		httpError(400, `Error while fetching feed. Error code: ${err.response.status}`);
	}
};

/**
 * Throws a error which can be usernamed and changed to HTTP Error in the Express js Error handling middleware.
 * @param  {number} code - HTTP error code
 * @param  {[type]} message - HTTP error message
 * @return {Error}
 */
const httpError = (code, message) => {
	code = code ? code : 500;
	message = message ? message : "Something went wrong";
	const errorObject = new Error(message);
	errorObject.httpErrorCode = code;
	throw errorObject;
};

module.exports = {
	getValidUsername,
	getValidListName,
	getValidEmail,
	getValidURL,
	isValidEmail,
	isValidUrl,
	isNewUsername,
	isNewEmail,
	getUserByEmail,
	sanitizeText,
	hashString,
	getValidPassword,
	httpError,
	attachUsertoRequest,
	attachUsertoRequestFromAPIKey,
	isUserAuthed,
	csrfValidator,
	rateLimit,
	speedLimiter,
	findFeedURL,
	fetchContentFromURL,
};
