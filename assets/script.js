/* global axios, Vue, cabin */

function getMeta(metaName) {
	const metas = document.getElementsByTagName("meta");
	for (let i = 0; i < metas.length; i++) {
		if (metas[i].getAttribute("name") === metaName) {
			return metas[i].getAttribute("content");
		}
	}
	return null;
}

function redirect(path, replace = false) {
	if (replace) window.location.replace(path);
	else window.location.href = path;
}

const initServiceWorker = async () => {
	if ("serviceWorker" in navigator) {
		await navigator.serviceWorker.register("/sw.js");
	}
};

const defaultState = function () {
	const searchParams = new URLSearchParams(window.location.search);
	const page = getMeta("pinggy-page");
	const username = getMeta("pinggy-username");
	const channelId = getMeta("pinggy-channel");
	const query = searchParams.get("q");

	return {
		online: navigator.onLine,
		visible: document.visibilityState === "visible",
		isLoading: true,
		isSaving: false,
		page,
		toast: [{ type: "", message: "" }],
		newAccount: { username: "", email: "", password: "" },
		authCreds: { username: "", password: "" },
		username,
		channelId,
		me: { username: "", email: "", password: "" },
		items: [],
		channels: [],
		addURL: "",
		myAccount: {},
		query,
		showSearch: !!query,
		showAdd: false,
		showLoadMore: false,
		urlState: searchParams.get("state"),
	};
};

const App = Vue.createApp({
	data() {
		return defaultState();
	},
	computed: {
		isloggedIn() {
			return !!this.username;
		},
	},
	methods: {
		setNetworkStatus() {
			this.online = navigator.onLine;
		},
		setVisibility() {
			this.visible = document.visibilityState === "visible";
		},
		resetState() {
			const newState = defaultState();
			Object.keys(newState).map((key) => (this[key] = newState[key]));
		},
		setToast(message, type = "error") {
			this.toast = { type, message, time: new Date().getTime() };
			setTimeout(() => {
				if (new Date().getTime() - this.toast.time >= 3000) {
					this.toast.message = "";
				}
			}, 3500);
		},
		userEvent(event) {
			if (cabin) cabin.event(event);
		},
		signUp() {
			if (!this.newAccount.username || !this.newAccount.email || !this.newAccount.password) {
				return this.setToast("All fields are mandatory");
			}
			axios.post("/api/signup", this.newAccount).then(this.authenticate);
			this.userEvent("signup");
		},
		signIn() {
			if (!this.authCreds.username || !this.authCreds.password) {
				return this.setToast("Please enter valid details");
			}
			axios.post("/api/login", this.authCreds).then(this.authenticate);
			this.userEvent("login");
		},
		forgotPassword() {
			if (!this.authCreds.username) {
				return this.setToast("Please enter your username");
			}
			axios.post("/api/reset", { username: this.authCreds.username }).then((response) => {
				this.setToast(response.data.message, "success");
			});
		},
		authenticate(response) {
			window.localStorage.username = this.username = response.data.username;
			this.newAccount = { username: "", email: "", password: "" };
			this.authCreds = { username: "", password: "" };
			redirect(this.urlState ?? "/", true);
			this.setToast(response.data.message, "success");
		},
		getMe(queryParams = "") {
			axios.get(`/api/me${queryParams}`).then((response) => {
				window.localStorage.username = this.username = response.data.username;
				this.me = { ...this.me, ...response.data };
				this.myAccount = { ...this.me };
			});
		},
		resendVerification() {
			axios.post("/api/resend").then((response) => {
				this.setToast(response.data.message, "success");
			});
		},
		updateAccount() {
			const { email, password } = this.myAccount;
			axios.put("/api/account", { email, password }).then((response) => {
				this.setToast(response.data.message, "success");
			});
		},
		search() {
			const url = new URL(window.location);
			if (this.query) url.searchParams.set("q", this.query);
			else url.searchParams.delete("q");

			history.pushState({}, "", url);
			this.items = [];
			this.getItems();
		},
		clearSearch() {
			if (!this.query) {
				this.search();
				this.showSearch = false;
			}
		},
		refreshItems() {
			this.items = [];
			this.getItems();
			this.addURL = "";
			this.showAdd = false;
		},
		getItems() {
			this.isLoading = true;
			const params = { q: this.query };
			if (this.channelId) params["channel"] = this.channelId;
			if (this.page === "saved") params["saved"] = "true";

			if (this.items.length > 0) params["skip"] = this.items.length;
			axios
				.get("/api/items", { params })
				.then((response) => {
					if (response.data.items.length > 0) {
						response.data.items.forEach((m) => this.items.push(m));
					}
					this.showLoadMore = response.data.items.length == 50;
				})
				.finally(() => (this.isLoading = false));
		},
		saveItem(id, link) {
			const body = {};
			if (id) body["id"] = id;
			else if (link) body["link"] = link;

			axios.post("/api/items/save", body).then((response) => {
				this.setToast(response.data.message, "success");
				if (this.page === "saved") this.refreshItems();
			});
		},
		unsaveItem(id) {
			axios.post("/api/items/unsave", { id }).then((response) => {
				this.setToast(response.data.message, "success");
			});
		},
		searchSubmitHandler(e) {
			e.preventDefault();
			e.stopPropagation();
		},
		refreshChannels() {
			this.channels = [];
			this.getChannels();
			this.addURL = "";
			this.showSearch = false;
		},
		getChannels() {
			this.isLoading = true;
			axios
				.get("/api/channels")
				.then((response) => {
					if (response.data.channels.length > 0) {
						response.data.channels.forEach((c) => this.channels.push(c));
					}
				})
				.finally(() => (this.isLoading = false));
		},
		subscribeChannel(e) {
			this.submitHandler(e);
			this.isSaving = true;
			axios
				.post("/api/channels/subscribe", { url: this.addURL })
				.then((response) => {
					this.setToast(response.data.message, "success");
					this.refreshChannels();
				})
				.finally(() => (this.isSaving = false));
		},
		unsubscribeChannel(channelId) {
			axios.post("/api/channels/unsubscribe", { channelId }).then((response) => {
				this.setToast(response.data.message, "success");
				this.refreshChannels();
			});
		},
		generateAPIKey() {
			this.isSaving = true;
			axios
				.post("/api/key")
				.then((response) => {
					this.setToast(response.data.message, "success");
					this.getMe("?apiKeys=true");
				})
				.finally(() => (this.isSaving = false));
		},
		deleteAPIKey(key) {
			if (confirm("Are you sure, you want to delete this API key? There is no undo.")) {
				axios.delete("/api/key/" + key).then((response) => {
					this.setToast(response.data.message, "success");
					this.getMe("?apiKeys=true");
				});
			}
		},
		submitHandler(e) {
			e.preventDefault();
			e.stopPropagation();
		},
		displayURL(_url) {
			let url = _url.replace(/^https?:\/\//i, "");
			url = url.length > 30 ? `${url.substr(0, 30)}...` : url;
			return url;
		},
		displayDate(datestring) {
			const seconds = Math.floor((new Date() - new Date(datestring)) / 1000);
			let interval = seconds / 31536000;
			const agoString = (val, timeIdentifier) => `${val} ${timeIdentifier}${val > 1 ? "s" : ""} ago`;
			if (interval > 1) return agoString(Math.floor(interval), "year");
			interval = seconds / 2592000;
			if (interval > 1) return agoString(Math.floor(interval), "month");
			interval = seconds / 86400;
			if (interval > 1) return agoString(Math.floor(interval), "day");
			interval = seconds / 3600;
			if (interval > 1) return agoString(Math.floor(interval), "hour");
			interval = seconds / 60;
			if (interval > 1) return agoString(Math.floor(interval), "minute");
			return "now";
		},
		logOut(autoSignOut) {
			const localClear = () => {
				window.localStorage.clear();
				this.resetState();
				redirect("/");
			};
			if (autoSignOut || confirm("Are you sure, you want to log out?")) axios.post("/api/logout").finally(localClear);
		},
		logError(message, source, lineno, colno) {
			const error = { message, source, lineno, colno, username: this.username, page: this.page };
			axios.post("/api/error", { error }).then(() => {});
			return true;
		},
		initApp() {
			if (this.isloggedIn) this.getMe();
		},
	},
}).mount("#app");

window.addEventListener("online", App.setNetworkStatus);
window.addEventListener("offline", App.setNetworkStatus);
document.addEventListener("visibilitychange", App.setVisibility);
window.onerror = App.logError;

(() => {
	const csrfToken = getMeta("csrf-token");
	if (csrfToken) {
		axios.defaults.headers.common["x-csrf-token"] = csrfToken;
	}

	axios.interceptors.request.use((config) => {
		window.cancelRequestController = new AbortController();
		return { ...config, signal: window.cancelRequestController.signal };
	});

	axios.interceptors.response.use(
		(response) => response,
		(error) => {
			console.log(error);
			if (error.request.responseURL.endsWith("api/me") && error.response.status === 401) {
				return App.logOut(true);
			}
			App.setToast(error.response.data.message || "Something went wrong. Please try again");
			throw error;
		}
	);
	initServiceWorker();
	App.initApp();
})();
