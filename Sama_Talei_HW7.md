# Homework 7

**Student:** Sama Talei

**Submitted on**: 2025-08-14

**Repository**: [GitHub Link](https://github.com/SamaTalei/DevOps_HW7.git)

### 🎥 Screencast of the monitoring dashboard
[Screencast of the monitoring dashboard]()

### Setup

#### For each server 1 , 2 , 3 repeat this:
```bash
docker run -dit --memory="1.0g" --cpus="1.0" --entrypoint sh --name server-01 --publish 4001:4001 --publish 5001:5001 node:alpine
docker exec -it server-01 sh

apk add git

git clone https://github.com/SamaTalei/DevOps_HW7
cd DevOps_HW7/
cd agent
npm install
cd ..
cd server
npm install

cd ..
npm run start-agent
npm run start-server
```
#### Then inside another terminal that you have cloned https://github.com/SamaTalei/DevOps_HW7:
```bash
cd monitoring
cd monitor
npm install
node index.js
```