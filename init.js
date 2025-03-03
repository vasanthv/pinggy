const express = require("express");
const path = require("path");
const app = express();

const config = require("./server/config");
const apiRoutes = require("./server/routes/api");
const viewRoutes = require("./server/routes/view");
const middlewares = require("./server/middlewares");

app.set("view engine", "ejs");

// Serve vue.js, page.js & axios to the browser
app.use(express.static(path.join(__dirname, "node_modules/axios/dist/")));
app.use(express.static(path.join(__dirname, "node_modules/vue/dist/")));

// Serve frontend assets & images to the browser
app.use(express.static(path.join(__dirname, "assets")));
app.use(express.static(path.join(__dirname, "assets/icons")));

// Attach the session middleware
app.use(middlewares);

// Handle API requests
app.use("/api", apiRoutes);

// Handle web view requests
app.use("/", viewRoutes);

// Start the server
app.listen(config.PORT, null, function () {
	console.log("Node version", process.version);
	console.log("Pinggy server running on port", config.PORT);
});
