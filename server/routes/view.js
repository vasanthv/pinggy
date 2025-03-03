const router = require("express").Router();
const { Items, Channels } = require("../model").getInstance();
const getViewProps = (req, title) => {
	let page = req.page ?? req.path.substr(1);
	if (!page) {
		page = req.user ? "feed" : "intro";
		title = title ?? (req.user ? "Pinggy" : "Pinggy - A free RSS aggregator");
	}

	return {
		page,
		title,
		user: req.user,
		csrfToken: req.csrfToken,
	};
};

router.get("/", async (req, res) => {
	if (req.user) res.render("feed", getViewProps(req));
	else res.render("intro", getViewProps(req));
});

router.get("/signup", async (req, res) => {
	if (req.user) res.redirect("/");
	res.render("signup", getViewProps(req, "Create an account - Pinggy"));
});

router.get("/login", async (req, res) => {
	if (req.user) res.redirect("/");
	res.render("login", getViewProps(req, "Log in - Pinggy"));
});

router.get("/channels", async (req, res) => {
	if (!req.user) res.redirect(`/login?state=${req.path}`);
	res.render("channels", getViewProps(req, "Channels - Pinggy"));
});

router.get("/channel/:id", async (req, res) => {
	const channel = await Channels.findOne({ _id: req.params.id });
	if (!channel) return res.render("404", getViewProps(req, "Page not found - Pinggy"));

	req.page = "channel";
	res.render("channel", { ...getViewProps(req, channel.title + " - Pinggy"), channel });
});

router.get("/saved", async (req, res) => {
	if (!req.user) res.redirect(`/login?state=${req.path}`);
	res.render("saved", getViewProps(req, "Saved items - Pinggy"));
});

router.get("/item/:id", async (req, res) => {
	const item = await Items.findOne({ _id: req.params.id }).populate("channel", "link feedURL title imageURL").exec();
	if (!item) return res.render("404", getViewProps(req, "Page not found - Pinggy"));

	res.render("item", { ...getViewProps(req, `${item.title} - Pinggy`), item });
});

router.get("/account", async (req, res) => {
	if (!req.user) res.redirect(`/login?state=${req.path}`);
	res.render("account", getViewProps(req, "Account - Pinggy"));
});

router.get("/api-keys", async (req, res) => {
	if (!req.user) res.redirect(`/login?state=${req.path}`);
	res.render("api-keys", getViewProps(req, "API Keys - Pinggy"));
});

router.get("/terms", async (req, res) => {
	res.render("terms", getViewProps(req, "Terms of service - Pinggy"));
});

router.get("/about", async (req, res) => {
	res.render("about", getViewProps(req, "About - Pinggy"));
});

router.get("/faq", async (req, res) => {
	res.render("faq", getViewProps(req, "Frequently asked questions - Pinggy"));
});

router.get("/privacy", async (req, res) => {
	res.render("privacy", getViewProps(req, "Privacy policy - Pinggy"));
});

router.get("/pricing", async (req, res) => {
	res.render("pricing", getViewProps(req, "Pricing - Pinggy"));
});

router.get("/*", async (req, res) => {
	res.render("404", getViewProps(req, "Page not found - Pinggy"));
});

module.exports = router;
