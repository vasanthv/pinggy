const postmark = require("postmark");

const config = require("../config");

const verificationEmail = (username, email, code) => {
	const verificartionEmailLink = `${config.URL}api/verify/${code}`;

	const params = {
		To: email,
		Subject: "Please verify your email",
		HtmlBody: `Hello @${username}<br/><br/>Please click on the link below to verify your email.<br/><a href="${verificartionEmailLink}" target='_blank'>${verificartionEmailLink}</a><br/><br/>Thanks<br/>`,
		TextBody: `Hello @${username}\n\nPlease click on the link below to verify your email.\n${verificartionEmailLink}\n\nThanks\n`,
	};
	sendEmail(params);
};

const resetPasswordEmail = (username, email, password) => {
	const params = {
		To: email,
		Subject: "Your password has been resetted.",
		HtmlBody: `Hello @${username}<br/><br/>Your password to log in to your Pinggy account is: <b>${password}</b><br/><br/>Note: Please change your password immediately after logging in.<br/><br/>Thanks<br/>`,
		TextBody: `Hello @${username}\n\nYour password to log in to Pinggy account is: ${password}\n\nNote: Please change your password immediately after logging in.\n\nThanks\n`,
	};
	sendEmail(params);
};

const sendEmail = async (params) => {
	try {
		var client = new postmark.ServerClient(config.POSTMARK_API_TOKEN);

		client.sendEmail({ From: config.NO_REPLY_EMAIL, ...params });
	} catch (err) {
		console.error(err);
	}
};

module.exports = { verificationEmail, resetPasswordEmail };
