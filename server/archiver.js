const { CronJob } = require("cron");

const { Items } = require("./model").getInstance();

const archiveOldItems = async () => {
	const nowMinus10Days = new Date();
	nowMinus10Days.setDate(nowMinus10Days.getDate() - 10);

	await Items.updateMany({ lastUpdatedOn: { $lt: nowMinus10Days } }, { isArchived: true });

	// const toBeDeletedItems = await Items.find({ $and: [{ isArchived: true }, { savedBy: { $size: 0 } }] });
	const toBeDeletedItems = await Items.deleteMany({ isArchived: true, savedBy: { $size: 0 } });

	console.log("Expired items", toBeDeletedItems);
};

const scheduleItemArchiver = () => {
	try {
		const cronTime = `0 0 * * *`;
		console.log("Job scheduled for archiving items everyday");

		CronJob.from({
			cronTime,
			onTick: () => archiveOldItems(),
			onComplete: () => console.log(`Completed archiving items`),
			start: true,
			runOnInit: true,
		});
	} catch (err) {
		console.error(err);
	}
};

module.exports = { scheduleItemArchiver };
