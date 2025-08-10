const express = require('express');
const app = express();
const httpServer = require('http').Server(app);
const { Server } = require('socket.io');
const { io } = require("socket.io-client");
require('dotenv').config({ path: '../.env' });
app.use(express.static('www'));

// TODO: update these if you used different ports!
const servers = [
    // { name: "computer", url: `http://localhost`, port: 5005, status: "#cccccc", scoreTrend: [] }, // you can also monitor your local machine
    { name: "server-01", url: `http://localhost`, port: 5001, status: "#cccccc", scoreTrend: [0] },
    { name: "server-02", url: `http://localhost`, port: 5002, status: "#cccccc", scoreTrend: [0] },
    { name: "server-03", url: `http://localhost`, port: 5003, status: "#cccccc", scoreTrend: [0] }
];

// ==================================================
// Connect to the Agent websocket servers
// ==================================================

for (const server of servers) {
    const agentSocket = io(server.url + ':' + server.port, { transports: ['websocket'] })
    console.log('Server connected:', server.name);
    agentSocket.on('monitoring-stats', async (data) => {
        console.log('monitoring-stats', data);
        server.memoryLoad = data.memoryLoad;
        server.cpuLoad = data.cpuLoad;
        server.uptime = data.uptime;
        server.rps = data.rps;
        updateHealth(server);
    });
}

// ==================================================
// Monitor socket to send data to the dashboard front-end
// ==================================================

const monitorSocket = new Server(httpServer, {
    transports: ['websocket'],
    cors: { origin: "*", methods: ["GET", "POST"] }
});
monitorSocket.on('connection', socket => {
    console.log('Monitoring dashboard connected');
    const heartbeatInterval = setInterval(() => {
        socket.emit('heartbeat', { servers });
    }, 1000);

    socket.on('disconnect', () => clearInterval(heartbeatInterval));
});

// ==================================================
// Latency calculation
// ==================================================

// TODO:
async function checkLatency(server) {
    const serverPort = server.port - 1000; // server HTTP port (400x)
    const start = Date.now();
    try {
        const res = await axios.get(`${server.url}:${serverPort}/`);
        server.latency = Date.now() - start;
        server.statusCode = res.status;
    } catch (err) {
        server.latency = null;
        server.statusCode = err.response ? err.response.status : 'ERR';
    }
}

setInterval(() => {
    servers.forEach(s => checkLatency(s));
}, 2000);

// ==================================================
// Score calculation
// ==================================================

// TODO:
function updateHealth(server) {
    let score = 0;

    // Update score calculation.
    if (server.cpuLoad > 80) score++; // CPU load > 80% => bad
    if (server.memoryLoad > 80) score++; // Memory load > 80% => bad
    if (server.latency !== null && server.latency > 200) score++; // Latency > 200ms => bad
    if (server.statusCode !== 200) score++; // Status not OK => bad

    server.status = score2color(score / 4);

    // console.log(`${server.name} ${score}`);
    console.log(server.scoreTrend)

    // Add score to trend data
    server.scoreTrend.push((4 - score));
    if (server.scoreTrend.length > 100) {
        server.scoreTrend.shift();
    }
}

function score2color(score) {
    if (score <= 0.25) return "#ff0000";
    if (score <= 0.50) return "#ffcc00";
    if (score <= 0.75) return "#00cc00";
    return "#00ff00";
}

// ==================================================

httpServer.listen(3000, () => {
    console.log('Example app listening on port 3000!');
});
