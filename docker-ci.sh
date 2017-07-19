#!/bin/bash -e
docker-compose build socket-redis
docker-compose -f docker-compose.test.yml build test-socket-redis
docker-compose -f docker-compose.test.yml run test-socket-redis
