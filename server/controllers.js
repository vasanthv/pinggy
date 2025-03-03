const { generateApiKey } = require("generate-api-key");
const randomString = require("randomstring");

const uuid = require("uuid").v4;

const utils = require("./utils");
const config = require("./config");
const sendEmail = require("./email");
const rssFetcher = require("./rss-fetcher");

const { Users, Channels, Items } = require("./model").getInstance();

const signUp = async (req, res, next) => {
	try {
		const username = utils.getValidUsername(req.body.username);
		await utils.isNewUsername(username);
		const email = utils.getValidEmail(req.body.email);
		await utils.isNewEmail(email);
		const password = utils.getValidPassword(req.body.password);
		const userAgent = req.get("user-agent");
		const date = new Date();

		const emailVerificationCode = uuid();
		const token = uuid();

		await new Users({
			username,
			email,
			password,
			emailVerificationCode,
			devices: [{ token, userAgent }],
			createdAt: date,
		}).save();
		req.session.token = token;

		res.json({ message: "Account created. Please verify your email.", username });

		sendEmail.verificationEmail(username, email, emailVerificationCode);
	} catch (error) {
		next(error);
	}
};

const logIn = async (req, res, next) => {
	try {
		const username = utils.getValidUsername(req.body.username);
		const password = utils.getValidPassword(req.body.password);

		const user = await Users.findOne({ username: { $regex: new RegExp(`^${username}$`, "i") }, password }).exec();

		if (!user) return utils.httpError(400, "Invalid user credentials");

		const userAgent = req.get("user-agent");

		const token = uuid();
		const devices = { token, userAgent };

		await Users.updateOne({ _id: user._id }, { $push: { devices }, lastLoginAt: new Date() });

		req.session.token = token;
		res.json({ message: "Logged in", username: user.username });
	} catch (error) {
		next(error);
	}
};

const verifyEmail = async (req, res, next) => {
	try {
		const code = req.params.code;

		const user = await Users.findOne({ emailVerificationCode: code }).exec();
		if (!user) return res.status(400).send("Invalid email verification code");

		await Users.updateOne({ _id: user._id }, { $unset: { emailVerificationCode: 1 }, lastUpdatedAt: new Date() });

		res.send("Email verified");
	} catch (error) {
		next(error);
	}
};

const resetPassword = async (req, res, next) => {
	try {
		const username = utils.getValidUsername(req.body.username);

		const user = await Users.findOne({ username }).exec();
		if (!user) return utils.httpError(400, "Invalid username");

		const passwordString = randomString.generate(8);
		const password = await utils.getValidPassword(passwordString);

		await Users.updateOne({ _id: user._id }, { password, lastUpdatedOn: new Date() });
		await sendEmail.resetPasswordEmail(user.username, user.email, passwordString);

		res.json({ message: "Password resetted" });
	} catch (error) {
		next(error);
	}
};

const me = async (req, res, next) => {
	try {
		const { username, email, joinedOn, apiKeys, emailVerificationCode } = req.user;

		const response = { username, email, joinedOn };
		if (req.query.apiKeys === "true") {
			response["apiKeys"] = apiKeys;
		}

		res.json({ ...response, isEmailVerified: !emailVerificationCode });
	} catch (error) {
		next(error);
	}
};

const resendEmailVerification = async (req, res, next) => {
	try {
		const { username, email, emailVerificationCode } = req.user;
		if (!emailVerificationCode) return utils.httpError(400, "Email has beed already verified");

		sendEmail.verificationEmail(username, email, emailVerificationCode);

		res.json({ message: "Re-sent verification email." });
	} catch (error) {
		next(error);
	}
};

const updateAccount = async (req, res, next) => {
	try {
		const email =
			req.body.email && req.body.email !== req.user.email ? await utils.getValidEmail(req.body.email) : null;
		if (email) await utils.isNewEmail(email, req.user._id);

		const password = req.body.password ? await utils.getValidPassword(req.body.password) : null;

		const updateFields = {};
		if (password) updateFields["password"] = password;

		if (email && email !== req.user.email) {
			const emailVerificationCode = uuid();
			updateFields["email"] = email;
			updateFields["emailVerificationCode"] = emailVerificationCode;
			await sendEmail.verificationEmail(req.user.username, email, emailVerificationCode);
		}

		await Users.updateOne({ _id: req.user._id }, { ...updateFields, lastUpdatedOn: new Date() });
		res.json({
			message: `Account updated. ${updateFields["emailVerificationCode"] ? "Please verify your email" : ""}`,
		});
	} catch (error) {
		next(error);
	}
};

const newApiKey = async (req, res, next) => {
	try {
		if (!req.user.userType === "paid") return utils.httpError(405, "This API cannot be used by free users");
		const apiKey = generateApiKey({ method: "uuidv4", dashes: false });

		await Users.updateOne({ _id: req.user._id }, { $push: { apiKeys: apiKey }, lastUpdatedOn: new Date() });

		res.json({ message: "API Key updated" });
	} catch (error) {
		next(error);
	}
};

const deleteApiKey = async (req, res, next) => {
	try {
		if (!req.user.userType === "paid") return utils.httpError(405, "This API cannot be used by free users");
		const apiKey = req.params.key;

		await Users.updateOne({ _id: req.user._id }, { $pull: { apiKeys: apiKey }, lastUpdatedOn: new Date() });

		res.json({ message: "API Key deleted" });
	} catch (error) {
		next(error);
	}
};

const getChannels = async (req, res, next) => {
	try {
		const channels = await Channels.find({ _id: { $in: req.user.channels.map((c) => c.channel) } })
			.select("link feedURL title description imageURL lastFetchedOn latestItemDate")
			.sort("-latestItemDate")
			.exec();

		res.json({ channels });
	} catch (error) {
		next(error);
	}
};

const subscribeChannel = async (req, res, next) => {
	try {
		if (req.user.emailVerificationCode) {
			return res.status(400).json({ message: "Please verify your email." });
		}

		let feedURL = utils.getValidURL(req.body.url);
		const date = new Date();

		let rssData = await rssFetcher(feedURL);

		if (rssData.error) {
			feedURL = await utils.findFeedURL(feedURL);
			if (!feedURL) {
				return utils.httpError(400, rssData.error);
			}
			rssData = await rssFetcher(feedURL);
		}

		if (rssData.error) {
			return utils.httpError(400, rssData.error);
		}

		let channel = await Channels.findOne({ link: rssData.channel.link }).exec();
		if (!channel) {
			channel = await new Channels({ ...rssData.channel, createdOn: date }).save();
		}

		if (req.user.channels.some((c) => c.channel.equals(channel._id))) {
			return res.json({ message: "Channel already subscribed" });
		}

		await Promise.all([
			Channels.updateOne({ _id: channel._id }, { $push: { subscribers: req.user._id }, lastFetchedOn: date }),
			Users.updateOne({ _id: req.user._id }, { $push: { channels: { channel: channel._id, subscribedOn: date } } }),
		]);

		res.json({ message: "Channel subscribed" });

		try {
			const itemUpserts = rssData.items.map((item) => {
				return Items.findOneAndUpdate(
					{ guid: item.guid },
					{ channel: channel._id, ...item, lastUpdatedOn: date },
					{ new: true, upsert: true }
				);
			});
			await Promise.all(itemUpserts);
		} catch (err) {
			// Do nothing
			console.error(err);
		}
	} catch (error) {
		next(error);
	}
};

const unsubscribeChannel = async (req, res, next) => {
	try {
		let channelId = req.body.channelId;
		await Users.updateOne({ _id: req.user._id }, { $pull: { channels: { channel: channelId } } });

		res.json({ message: "Channel unsubscribed" });
	} catch (error) {
		next(error);
	}
};

const getItems = async (req, res, next) => {
	try {
		const channelIds = req.user.channels.map(({ channel }) => channel);
		const channel = req.query.channel;
		const saved = req.query.saved === "true";

		const skip = Number(req.query.skip) || 0;
		const q = req.query.q;

		let query = { channel: { $in: channelIds.map((c) => c._id) }, isArchived: { $exists: false } };

		if (channel) query = { channel, isArchived: { $exists: false } };
		if (saved) query = { savedBy: req.user._id };
		if (q) query = { $and: [{ ...query }, { $text: { $search: q } }] };

		const _items = await Items.find(query)
			.select("channel title link author comments publishedOn savedBy")
			.populate("channel", "link feedURL title imageURL")
			.skip(skip)
			.limit(config.PAGE_LIMIT)
			.sort(saved ? "-savedOn" : "-publishedOn")
			.exec();

		const items = _items.map((item) => {
			const { _id, channel, title, link, author, comments, publishedOn, savedBy } = item;
			return { _id, channel, title, link, author, comments, publishedOn, isSaved: savedBy.includes(req.user._id) };
		});

		res.json({ items });
	} catch (error) {
		next(error);
	}
};

const saveItem = async (req, res, next) => {
	try {
		const id = req.body.id;
		const link = req.body.link;

		if (id) {
			const item = await Items.findOne({ _id: id }).exec();
			if (!item) return utils.httpError(400, "Invalid request");

			const { content, textContent } = await utils.fetchContentFromURL(item.link);

			const updateFields = { $push: { savedBy: req.user._id, savedOn: new Date() } };
			if (content) {
				updateFields["content"] = content;
				updateFields["textContent"] = textContent;
			}
			await Items.updateOne({ _id: id }, { ...updateFields });
			return res.json({ message: "Saved successfully" });
		}

		if (!link) {
			return utils.httpError(400, "Invalid request");
		}

		const item = await Items.findOne({ link }).exec();

		if (item && item.savedBy.includes(req.user._id)) {
			return utils.httpError(400, "Item already saved");
		}

		if (item) {
			await Items.updateOne({ _id: item._id }, { $push: { savedBy: req.user._id }, savedOn: new Date() });
			return res.json({ message: "Saved successfully" });
		}

		const { title, content, textContent } = await utils.fetchContentFromURL(link);

		await new Items({
			link,
			title,
			content,
			textContent,
			savedBy: [req.user._id],
			savedOn: new Date(),
		}).save();

		return res.json({ message: "Saved successfully" });
	} catch (error) {
		next(error);
	}
};

const unsaveItem = async (req, res, next) => {
	try {
		const id = req.body.id;

		const item = await Items.findOne({ _id: id }).exec();

		if (!item) {
			return utils.httpError(400, "Invalid request");
		}

		if (item && !item.savedBy.includes(req.user._id)) {
			return utils.httpError(400, "Item not saved");
		}

		await Items.updateOne({ _id: item._id }, { $pull: { savedBy: req.user._id } });
		return res.json({ message: "Unsaved successfully" });
	} catch (error) {
		next(error);
	}
};

const logOut = async (req, res, next) => {
	try {
		await Users.updateOne({ _id: req.user._id }, { $pull: { devices: { token: req.token } } });
		req.session.destroy();
		res.json({ message: "Logged out" });
	} catch (error) {
		next(error);
	}
};

module.exports = {
	signUp,
	logIn,
	verifyEmail,
	resendEmailVerification,
	resetPassword,
	updateAccount,
	me,
	newApiKey,
	deleteApiKey,
	subscribeChannel,
	unsubscribeChannel,
	getChannels,
	getItems,
	saveItem,
	unsaveItem,
	logOut,
};
