//importing express and socket server modules
import express, { json, response } from "express";
const app = express();
import http from "http";
import { Server as SocketServer } from "socket.io";

// importing path modules;
import path from 'path';
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//importing express extensions
import cors from "cors";
import helmet from "helmet";
import bodyParser from "body-parser";

//importing firebase utils
import admin from "firebase-admin";
import creds from "./key.json" assert { type: "json" };
import dotenv from "dotenv";
dotenv.config();

process.env.GOOGLE_APPLICATION_CREDENTIALS;
 admin.initializeApp({
	credential: admin.credential.cert(creds),
});

//Server start----------------------------------------------------------------------------------------------------------------------
const db = admin.firestore();
const alertsRef = db.collection("Alerts")
const busStopsRef = db.collection("BusStops")
const busRoutesRef = db.collection("BusRoutes")
const userRef = db.collection("Users");

//Initialising Data------------------------------------------------------------------------------------------------------------------
const busI123 = {							// Will Dynamically change
	id: 123,
	passengers: 12,
	latitude: 18.994449327500444,
	longitude: 73.11439604269852,
	lastLocation: "Panvel",
};

const busI234 = {
	id: 234,
	passengers: 14,
	latitude: 19.012721341691616,
	longitude: 73.09430047024335,
	lastLocation: "Khandeshwar",
};

// Express initialisations-------------------------------------------------------------------------------------------------------------
app.use(bodyParser.urlencoded({ extended: true }));
app.set("views",path.join(__dirname,"/views"));
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "/engine")));

app.use(express.json());
app.use(function (req, res, next) {
	res.setHeader("Content-Type", "application/json");
	next();
});
app.use(cors());
app.use(helmet());

// Open RESTful End Points --------------------------------------------------------------------------------------------------------- 

app.get("/", (req, res) => {
	res.render("index", { appname : "City Link - 1"});
});

app.get("/ride", (req, res) => {
	res.render("downloads")
})


//Sockets creation------------------------------------------------------------------------------------------------------------------------------------------------

const server = http.createServer(app);
const io = new SocketServer(server);

io.use((socket, next) => {							// Socket connection security
	const apiKey = socket.handshake.query.apiKey;
	if (apiKey === process.env.applicationSecret) {
		return next();
	}
	console.log(`Api Key = ${apiKey}`)
	return next(new Error("Unauthorized"));
});

io.on('connect', (socket) => {						// Socket Connect
	const userId = socket.handshake.query.userId;
	console.log(`User is connected -> ${userId}`)

	function emitBusData() {
		socket.emit('LiveBusData', busI123, busI234 );
	}
	const emittingBusData = setInterval(emitBusData, 5000); // Emit bus live locations

	socket.on('serviceStart', (dataJson) => {				// Tracking user location - Onboarding Process
		const data = JSON.parse(dataJson);
		console.log(`User -> ${data.ID} boarded bus -> ${data.busID}`)
	})

	socket.on("locationUpdate", (dataJson) => {				// Tracking user location - Live Tracking
		const data = JSON.parse(dataJson);
		console.log(
			`Location updated data : ${data.ID} -> latitude ${data.latitude} longitude ${data.longitude}`,
		);
	});

	socket.on("serviceStop", (dataJson) => {				// Tracking user location - Deboarding Process
		const data = JSON.parse(dataJson);
		console.log(`User -> ${data.ID} deboarded bus -> ${data.busID}`);
	});

	socket.on("disconnect", () => {
		console.log(`User -> ${userId}  disconnected`);
		clearInterval(emittingBusData); // Stop emitting data when the client disconnects
	});

});

//API-security--------------------------------------------------------------------------------------------------------
app.use("/secure", (req, res, next) => { 
	const apiKey = req.get("X-Api-Key"); 
	if (apiKey === process.env.applicationSecret) {			// Correct API Key
		next();
	} else {
		res.status(401).json({ error: "Unauthorized" });
	}
})

// roadblocks creation and document change listener and recevier --------------------------------------------------------------------------------------------------
const roadblocks = []
const alertsObserver = alertsRef.onSnapshot(snapshot => {
	snapshot.docChanges().forEach(change => {
		const docData = change.doc.data();
		if (change.type === 'added' || change.type === 'modified') {
			const existingIndex = roadblocks.findIndex(item => item.id === change.doc.id)
			if (existingIndex !== -1) {
				roadblocks[existingIndex] = { id: change.doc.id, ...docData };
			} else {
				roadblocks.push({ id: change.doc.id, ...docData });
			}
		} else if (change.type === 'removed') {
			const removeIndex = roadblocks.findIndex(item => item.id === change.doc.id);
			if (removeIndex !== -1) {
				roadblocks.splice(removeIndex, 1);
			}
		}
	})
	console.log("alerts Observer active")
});

app.get("/secure/roadblocks", async (req, res) => {
	console.log("attempting to get road Blocks");
	res.json(roadblocks);
});

//busStops and busRoutes creation and document change listener------------------------------------------------------------------------------
const busStops = [];
const busStopsObserver =  busStopsRef.onSnapshot(snapshot => {
	snapshot.docChanges().forEach(change => {
		const docData = change.doc.data();
		if (change.type === "added" || change.type === "modified") {
			const existingIndex = busStops.findIndex(
				item => item.id === change.doc.id,
			);
			if (existingIndex !== -1) {
				busStops[existingIndex] = { id: change.doc.id, ...docData };
			} else {
				busStops.push({ id: change.doc.id, ...docData });
			}
		} else if (change.type === "removed") {
			const removeIndex = busStops.findIndex(
				item => item.id === change.doc.id,
			);
			if (removeIndex !== -1) {
				busStops.splice(removeIndex, 1);
			}
		}
	});
	console.log("BusStops Observer active");
});

app.get("/secure/busstops", async (req, res) => {
	console.log("attempting to get bus Stops");
	res.json(busStops);
});

const routes = []
const busRoutesObserver = busRoutesRef.onSnapshot(snapshot => {
	snapshot.docChanges().forEach(change => {
		const docData = change.doc.data();
		if (change.type === "added" || change.type === "modified") {
			const existingIndex = routes.findIndex(
				item => item.id === change.doc.id,
			);
			if (existingIndex !== -1) {
				routes[existingIndex] = { id: change.doc.id, ...docData };
			} else {
				routes.push({ id: change.doc.id, ...docData });
			}
		} else if (change.type === "removed") {
			const removeIndex = routes.findIndex(item => item.id === change.doc.id);
			if (removeIndex !== -1) {
				routes.splice(removeIndex, 1);
			}
		}
	});
	console.log("BusRoutes Observer active");
})

app.get("/secure/busRoutes", async (req, res) => {
	console.log("attempting to get bus Routes");
	res.json(routes);
});

// add busStops -----------------------------------------------------------------------------------------------------
app.post("/secure/addbusstops", async (req, res) => {
	const stop = {
		title: req.body.title,
		latitude: req.body.latitude,
		longitude: req.body.longitude,
	};
	busStopsRef.doc(stop.title).set(stop);
});

app.post("/secure/addbusroute", async (req, res) => {
	const route = {
		title: req.body.title,
		route: req.body.route,
	};
	const result = busRoutesRef.doc(req.body.title).set(route);
	res.send(result);
});



// add alert -----------------------------------------------------------------------------------------------------
app.post("/secure/addalert", async (req, res) => {
	const longitude = req.body.longitude;
	const latitude = req.body.latitude;
	const reason = req.body.reason;
	const address = req.body.address;

	const data = {
		longitude: longitude,
		latitude: latitude,
		reason: reason,
		address: address,
		timeinmillis: Date.now(),
	};

	await alertsRef.doc(address).set(data);

	var message = {
		notification: {
			title: reason,
			body: address,
		},
	};

	admin
		.messaging()
		.sendToTopic("alerts", message)
		.then(response => {
			console.log("Notification sent:", response.data);
			res.status(200).json({ result: "Alert created successfully" });
		})
		.catch(error => {
			console.error("Error sending notification:", error);
			res.status(500).json({ result: "Error creating alert" });
		});
});

// const PORT = process.env.PORT || 3000;
server.listen(process.env.PORT || 3000, () => {
	console.log(`Server is running on Port: ` + (process.env.PORT || 3000));
});
