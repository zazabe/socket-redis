ARG FROM_TAG=6
FROM node:${FROM_TAG}

WORKDIR '/app'

RUN apt-get update && apt-get install -y redis-tools

COPY package.json ./
RUN npm install

COPY docker ./docker
COPY bin ./bin
COPY lib ./lib
COPY client ./client
COPY socket-redis.js ./

ENV REDIS_HOST=redis
ENV SOCKET_PORTS=8090
ENV STATUS_PORT=8085
ENV STATUS_TOKEN=""

EXPOSE 8085
ENTRYPOINT ["./docker/run.sh"]
CMD ["start"]
