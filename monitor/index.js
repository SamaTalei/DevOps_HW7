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
    { name: "server-01", url: `http://localhost`, port: 5001, status: "#cccccc", scoreTrend: [0], lastResponseTime: Date.now() },
    { name: "server-02", url: `http://localhost`, port: 5002, status: "#cccccc", scoreTrend: [0], lastResponseTime: Date.now() },
    { name: "server-03", url: `http://localhost`, port: 5003, status: "#cccccc", scoreTrend: [0], lastResponseTime: Date.now() }
];

// ==================================================
// Connect to the Agent websocket servers
// ==================================================

for (const server of servers) {
    const agentSocket = io(server.url + ':' + server.port, { transports: ['websocket'] })
    agentSocket.on('monitoring-stats', async (data) => {
        console.log('monitoring-stats', data);
        server.memoryLoad = data.memoryLoad;
        server.cpuLoad = data.cpuLoad;
        server.uptime = data.uptime;
        server.rps = data.rps;
        server.lastResponseTime = Date.now();
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
    const start = Date.now();
    const serverPort = server.port - 1000; // server HTTP port (400x)
    try {
        const response = await fetch(`${server.url}:${serverPort}/`);
        server.latency = Date.now() - start;
        server.statusCode = response.status;
    } catch (err) {
        server.latency = -1;
        server.statusCode = err.response ? err.response.status : 'ERR';
        // server.statusCode = 0;
    }
}

setInterval(() => {
    servers.forEach(s => checkLatency(s));
}, 2000);

// Check for agent
function checkAgent() {
    const timer = 10000;
    const now = Date.now();

    for (const server of servers) {
        if (!server.lastResponseTime || (now - server.lastResponseTime > timer)) {
            server.memoryLoad = -1;
            server.cpuLoad = -1;
            server.uptime = -1;
            server.rps = -1;
            server.statusCode = -1;
            updateHealth(server);
        }
    }
}

setInterval(checkAgent, 5000);


// ==================================================
// Score calculation
// ==================================================

function updateHealth(server) {
    let score = 0;

    const isNumber = (val) => typeof val === 'number' && !isNaN(val);

    if (
        server.cpuLoad === -1 ||
        server.memoryLoad === -1 ||
        server.uptime === -1 ||
        server.rps === -1 ||
        server.statusCode === -1
    ) {
        server.status = score2color(0);
        if (server.scoreTrend.length > 100) server.scoreTrend.shift();
        return;
    }

    if (isNumber(server.cpuLoad) && server.cpuLoad >= 0) {
        if (server.cpuLoad <= 50) score += 2;
        else if (server.cpuLoad <= 70) score += 1.5;
        else if (server.cpuLoad <= 85) score += 1;
        else if (server.cpuLoad <= 95) score += 0.5;
    }

    if (isNumber(server.memoryLoad) && server.memoryLoad >= 0) {
        if (server.memoryLoad <= 60) score += 2;
        else if (server.memoryLoad <= 75) score += 1.5;
        else if (server.memoryLoad <= 85) score += 1;
        else if (server.memoryLoad <= 95) score += 0.5;
    }

    if (isNumber(server.latency)) {
        if (server.latency === -1) score += 0;
        else if (server.latency <= 50) score += 1;
        else if (server.latency <= 200) score += 0.75;
        else if (server.latency <= 500) score += 0.5;
        else if (server.latency <= 1000) score += 0.25;
    }

    if (isNumber(server.statusCode)) {
        if (server.statusCode >= 200 && server.statusCode < 300) score += 1;

    }

    if (isNumber(server.uptime) && server.uptime >= 0) {
        const uptimeH = server.uptime / 3600;
        if (uptimeH >= 24) score += 0.5;
        else if (uptimeH >= 12) score += 0.25;
        else if (uptimeH >= 1) score += 0.15;
    }

    if (isNumber(server.rps) && server.rps >= 0) {
        if (server.rps >= 100) score += 0.5;
        else if (server.rps >= 50) score += 0.25;
        else if (server.rps >= 10) score += 0.15;
        else if (server.rps >= 1) score += 0.1;
    }

    const sumMaxScores = 7;

    const healthPercentage = Math.min(score / sumMaxScores, 1);
    server.status = score2color(healthPercentage);

    console.log(
        `${server.name} health score: ${score.toFixed(2)}/${sumMaxScores} (${(healthPercentage * 100).toFixed(1)}%)`
    );

    server.scoreTrend.push(sumMaxScores - score);
    if (server.scoreTrend.length > 100) server.scoreTrend.shift();
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
