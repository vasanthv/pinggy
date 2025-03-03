/**
 * A singleton implemetaion for the database collections
 */

const mongoose = require("mongoose");
const config = require("./config");

module.exports = (() => {
	let instance;
	let db = mongoose.connection;
	const Schema = mongoose.Schema;

	mongoose.set("strictQuery", true);

	const connectToDb = () => {
		mongoose.connect(config.MONGODB_URI);
	};

	const createInstance = () => {
		db.on("error", (error) => {
			console.error("Error in MongoDb connection: " + error);
			mongoose.disconnect(); // Trigger disconnect on any error
		});
		db.on("connected", () => console.log("Pinggy DB connected"));
		db.on("disconnected", () => {
			console.log("MongoDB disconnected!");
			connectToDb();
		});

		connectToDb();

		console.log("Pinggy DB initialized");

		const userSchema = new Schema({
			username: { type: String, index: true, required: true, unique: true, match: /^([a-zA-Z0-9]){1,18}$/ },
			email: { type: String, index: true, unique: true, required: true },
			password: { type: String, required: true },
			emailVerificationCode: { type: String, index: true },
			joinedOn: { type: Date, default: Date.now },
			lastLoginOn: Date,
			lastUpdatedOn: Date,
			devices: [
				{
					token: { type: String, index: true },
					userAgent: { type: String },
				},
			],
			channels: [
				{
					channel: { type: Schema.Types.ObjectId, ref: "Channels", index: true },
					subscribedOn: Date,
				},
			],
			apiKeys: [{ type: String, index: true }],
		});

		const channelSchema = new Schema({
			link: { type: String, index: true, required: true, unique: true },
			feedURL: { type: String, index: true },
			title: String,
			description: String,
			imageURL: String,
			createdOn: { type: Date, default: Date.now },
			lastFetchedOn: Date, // Last successful fetch of the RSS feed
			latestItemDate: Date,
			fetchIntervalInMinutes: { type: Number, default: 60 },
		});

		const itemSchema = new Schema({
			guid: { type: String, index: true },
			channel: { type: Schema.Types.ObjectId, ref: "Channels", index: true },
			title: String,
			link: { type: String, index: true },
			content: String,
			textContent: String,
			comments: String,
			author: String,
			publishedOn: { type: Date, index: true },
			lastUpdatedOn: { type: Date, index: true },
			isArchived: { type: Boolean, index: true },
			savedOn: { type: Date, index: true },
			savedBy: [{ type: Schema.Types.ObjectId, ref: "Users", index: true }],
		});
		itemSchema.index({ title: "text", textContent: "text" });

		const Users = mongoose.model("Users", userSchema);
		const Channels = mongoose.model("Channels", channelSchema);
		const Items = mongoose.model("Items", itemSchema);

		Items.syncIndexes();

		return { Channels, Items, Users };
	};
	return {
		getInstance: () => {
			if (!instance) {
				instance = createInstance();
			}
			return instance;
		},
	};
})();
