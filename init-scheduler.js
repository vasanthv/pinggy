const express = require("express");
const app = express();

const config = require("./server/config");
const { initAllChannelsFetch: initChannelScheduler } = require("./server/scheduler");
const { scheduleItemArchiver: initItemArchiver } = require("./server/archiver");

global.fetchIntervalOverride = 15;

console.log(`Fetching feeds every ${global.fetchIntervalOverride} minutes`);

// Handle web view requests
app.get("/", (req, res) => {
	res.send("Pinggy RSS fetch service is running");
});

// Start the server
app.listen(config.PORT, null, function () {
	console.log("Node version", process.version);
	console.log("Pinggy server running on port", config.PORT);
});

// Initialize the scheduler for every channel to fetch on a regular interval
initChannelScheduler();
// Initialize the item archiver
initItemArchiver();
