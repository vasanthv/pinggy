const router = require("express").Router();
const bodyParser = require("body-parser");
const morgan = require("morgan");

const apiHandler = require("../controllers");
const utils = require("../utils");

router.use(bodyParser.json());
router.use(bodyParser.urlencoded({ extended: false }));
router.use(morgan("dev")); // for dev logging

router.get("/verify/:code", apiHandler.verifyEmail);

// Logging UI errors
router.post("/error", (req, res) => {
	console.error({ browserError: req.body });
	res.send();
});

router.use(utils.csrfValidator);

router.post("/signup", utils.rateLimit({ windowMs: 30, max: 2, skipFailedRequests: true }), apiHandler.signUp);
router.post("/login", utils.rateLimit({ max: 5 }), apiHandler.logIn);
router.post("/reset", utils.rateLimit({ max: 5 }), apiHandler.resetPassword);
router.post("/resend", utils.rateLimit({ max: 1 }), apiHandler.resendEmailVerification);

router.use(["/me", "/items", "/channels"], utils.attachUsertoRequestFromAPIKey);
router.use(utils.isUserAuthed);

router.get("/me", apiHandler.me);
router.put("/account", apiHandler.updateAccount);

router.post("/key", apiHandler.newApiKey);
router.delete("/key/:key", apiHandler.deleteApiKey);

router.get("/channels", apiHandler.getChannels);
router.post("/channels/subscribe", apiHandler.subscribeChannel);
router.post("/channels/unsubscribe", apiHandler.unsubscribeChannel);

router.get("/items", apiHandler.getItems);
router.post("/items/save", apiHandler.saveItem);
router.post("/items/unsave", apiHandler.unsaveItem);

router.post("/logout", apiHandler.logOut);

/**
 * API endpoints common error handling middleware
 */
router.use(["/:404", "/"], (req, res) => {
	res.status(404).json({ message: "ROUTE_NOT_FOUND" });
});

// Handle the known errors
router.use((err, req, res, next) => {
	if (err.httpErrorCode) {
		res.status(err.httpErrorCode).json({ message: err.message || "Something went wrong" });
	} else {
		next(err);
	}
});

// Handle the unknown errors
router.use((err, req, res) => {
	console.error(err);
	res.status(500).json({ message: "Something went wrong" });
});

module.exports = router;
