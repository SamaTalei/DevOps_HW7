const fs = require('fs').promises;
const { createServer } = require('http');
const { Server } = require('socket.io');
const http = require('http');
require('dotenv').config({ path: '../.env' });

class Agent {
    constructor() {
        this.lastCpuCheck = Date.now();
        this.lastCpuUsage = 0;
        this.startTime = Date.now();
        this.requestCount = 0;
    }

    async memoryLoad() {
        // TODO: calculate memory load
        // see:
        // /sys/fs/cgroup/memory.current
        // /sys/fs/cgroup/memory.max
        try {
            const memCurrent = parseInt(await fs.readFile('/sys/fs/cgroup/memory.current', 'utf8'));
            const memMax = parseInt(await fs.readFile('/sys/fs/cgroup/memory.max', 'utf8'));
            if (isNaN(memCurrent) || isNaN(memMax) || memMax === 0) return 0;
            return Math.round((memCurrent / memMax) * 100);
        } catch (err) {
            console.error('Memory load error:', err);
            return 0;
        }
    }

    async cpuLoad() {
        // TODO: calculate cpu load
        // to calculate CPU load:
        // 1. read usage_usec value from /sys/fs/cgroup/cpu.stat this is cpu time in microseconds
        // 2. store usage_usec on each run of cpuLoad() and calculate how much is increased since last run (you can store it in this.lastCpuUsage)
        // 3. store and calculate time since last time cpuLoad() was called (you can store timestamps from Date.now() and calculate the time difference)
        // 4. calculate the cpu load percentage as (usage_usec changes since last run / time since last run in seconds) * 100

        try {
            const cpuStat = await fs.readFile('/sys/fs/cgroup/cpu.stat', 'utf8');
            const usageLine = cpuStat.split('\n').find(line => line.startsWith('usage_usec'));
            if (!usageLine) return 0;
            const usage = parseInt(usageLine.split(' ')[1]); // microseconds

            const now = Date.now();
            const timeDeltaSec = (now - this.lastCpuCheck) / 1000;
            const usageDeltaSec = (usage - this.lastCpuUsage) / 1e6; // to seconds

            this.lastCpuCheck = now;
            this.lastCpuUsage = usage;

            if (timeDeltaSec > 0) {
                return Math.min(100, Math.round((usageDeltaSec / timeDeltaSec) * 100));
            }
            return 0;
        } catch (err) {
            console.error('CPU load error:', err);
            return 0;
        }
    }

    // other metrics

    async uptime() {
        return Math.floor((Date.now() - this.startTime) / 1000); // seconds
    }

    async rps() {
        const rps = this.requestCount;
        this.requestCount = 0;
        return rps;
    }

}


const agent = new Agent();
const httpServer = createServer();
const io = new Server(httpServer, {
    transports: ['websocket']
});

io.on('connection', (socket) => {
    console.log('Agent connected to monitor');

    socket.on('increment-req', () => {
        agent.requestCount++;
    });

    setInterval(async () => {
        const memoryLoad = await agent.memoryLoad();
        const cpuLoad = await agent.cpuLoad();
        const uptime = await agent.uptime();
        const rps = await agent.rps();
        console.log({ memoryLoad, cpuLoad, uptime, rps });
        socket.emit('monitoring-stats', { memoryLoad, cpuLoad, uptime, rps });
    }, 1000);
});

httpServer.listen(process.env.AGENT_PORT || 5001, () => {
    console.log('Agent listening on port ' + (process.env.AGENT_PORT || 5001) + '!');
});
