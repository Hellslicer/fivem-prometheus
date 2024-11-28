const prometheus = require('prom-client');
const register = prometheus.register;

const prometheusTimeout = GetConvarInt('prometheus_timeout', 5000);
const authEnabled = GetConvarInt('prometheus_auth_enabled', 0);
const authLogin = GetConvar('prometheus_login', 'admin');
const authPassword = GetConvar('prometheus_password', 'admin');
const authorizationHeader = 'Basic ' + new Buffer(authLogin + ':' + authPassword).toString('base64');

// Collect some default FiveM metrics
const playerCount = new prometheus.Gauge({ name: 'fxs_player_count', help: 'Number of connected players.' });
const playerConnections = new prometheus.Counter({ name: 'fxs_player_connections', help: 'Number of player connections.' });
const playerDisconnections = new prometheus.Counter({ name: 'fxs_player_disconnections', help: 'Number of player disconnections.' });
const averageLatency = new prometheus.Gauge({ name: 'fxs_average_player_latency', help: 'Average player latency.' });
const latencyHistogram = new prometheus.Histogram({ name: 'fxs_players_latency', help: 'Players latency.', buckets: [10, 20, 50, 70, 100, 120, 150, 160, 200] });
const minPlayerPing = new prometheus.Gauge({ name: 'fxs_min_player_ping', help: 'Minimum player ping.' });
const maxPlayerPing = new prometheus.Gauge({ name: 'fxs_max_player_ping', help: 'Maximum player ping.' });

const objectCountG = new prometheus.Gauge({ name: 'fxs_object_count', help: 'Current object count.'});
const pedCountG = new prometheus.Gauge({ name: 'fxs_ped_count', help: 'Current ped count.'});
const vehicleCountG = new prometheus.Gauge({ name: 'fxs_vehicle_count', help: 'Current vehicle count.'});

const eventsSentToClient = new prometheus.Gauge({ name: 'fxs_events_client', help: 'Events sent to client from server'});
const eventsSentToServer = new prometheus.Gauge({name : 'fxs_events_server', help: 'Events sent from server to server'});

function delay(time) {
	return new Promise(resolve => setTimeout(resolve, time));
}

async function gatherEvents() {
	let sCount = 0;
	let cCount = 0;
	emit("prometheus:_gatherEventCount", function(serverCount, clientCount) {
		sCount += serverCount;
		cCount += clientCount;
	});

	await delay(1000);

	eventsSentToClient.set(cCount);
	eventsSentToServer.set(sCount);

	setTimeout(gatherEvents, 1000);
}
setTimeout(gatherEvents, 1000);


setInterval(async () => {
	const numIndices = GetNumPlayerIndices();

	let cumulativeLatency = 0;
	let minPing, maxPing;

	const objectCount = GetAllObjects().length;
	const pedCount = GetAllPeds().length;
	const vehicleCount = GetAllVehicles().length;
	objectCountG.set(objectCount);
	pedCountG.set(pedCount);
	vehicleCountG.set(vehicleCount);


	for (let playerIndex = 0; playerIndex < numIndices; playerIndex++) {
		const player = GetPlayerFromIndex(playerIndex);
		const playerPing = GetPlayerPing(player);
		cumulativeLatency += playerPing;
		if (!minPing || minPing > playerPing) {
			minPing = playerPing;
		}
		if (!maxPing || maxPing < playerPing) {
			maxPing = playerPing;
		}
		latencyHistogram.observe(playerPing);
	}

	playerCount.set(numIndices);
	if (numIndices > 0) {
		averageLatency.set(cumulativeLatency / numIndices);
		minPlayerPing.set(minPing);
		maxPlayerPing.set(maxPing);
	} else {
		averageLatency.set(0);
		minPlayerPing.set(0);
		maxPlayerPing.set(0);
	}
}, prometheusTimeout);

on('playerConnecting', (playerName, setKickReason, tempPlayer) => {
	playerConnections.inc();
});

on('playerDropped', (player, disconnectReason) => {
	playerDisconnections.inc();
});

/**
 * Server event
 * @event prometheus:addMetric
 *
 * @param {string} type - The metric type, i.e. Gauge.
 * @param {string} name - The metric name.
 * @param {string} description - The metric description.
 * @param {function} cb - A callback function to update the metric with a method name (i.e. set) and a value.
 */
on('prometheus:addMetric', (type, name, description, cb) => {
	if (!prometheus[type]) {
		console.error(`[FiveM Prometheus] Invalid metric type ${type} for ${name}`);
		return;
	}
	let metric = new prometheus[type]({ name: name, help: description });

	setInterval(() => {
		cb((methodName, value) => {
			if (metric[methodName]) {
				metric[methodName](value);
			}
		});
	}, prometheusTimeout);
});

on('prometheus:_getMetrics', (cb) => {
	cb(register.metrics());
});

// Don't use this for now, there is a deadlock somewhere :/
/*SetHttpHandler((req, res) => {
	const authorizedRequest = !authEnabled || req.headers['Authorization'] === authorizationHeader;
	if (req.path === '/metrics' && authorizedRequest) {
		res.send(register.metrics());
	} else {
		res.send('Route /' + GetCurrentResourceName() + req.path + ' not found.');
	}
});*/
