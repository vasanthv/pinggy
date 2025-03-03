module.exports = {
	NODE_ENV: process.env.NODE_ENV,
	PORT: process.env.PORT || 755,
	PAGE_LIMIT: 50,
	URL: process.env.NODE_ENV === "production" ? "https://pinggy.com/" : "http://localhost:755/",
	MONGODB_URI: process.env.MONGODB_URI || "mongodb://localhost:27017/pinggy-dev",
	DISABLE_CSRF: process.env.DISABLE_CSRF,
	CSRF_TOKEN_EXPIRY: 60 * 30, // 30 mins
	SECRET: process.env.SECRET ?? "some-secret",
	AWS_ACCESS_KEY: process.env.AWS_ACCESS_KEY_ID,
	AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
	POSTMARK_API_TOKEN: process.env.POSTMARK_API_TOKEN,
	NO_REPLY_EMAIL: process.env.NO_REPLY_EMAIL ?? "Pinggy <noreply@pinggy.com>",
	INVALID_HANDLES: ["administrator", "admin", "bot", "pinggy"],
	CONTACT_EMAIL: process.env.CONTACT_EMAIL ?? "hello@pinggy.com",
};
