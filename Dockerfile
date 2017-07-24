FROM node:6

WORKDIR '/opt/socket-redis'

RUN apt-get update && apt-get install -y redis-tools
COPY package.json ./
RUN npm install --only=production
COPY . ./

EXPOSE 8085 8090 8091
CMD ["./bin/socket-redis.js"]
