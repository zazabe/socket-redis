#!/bin/bash -e

REDIS_HOST=${REDIS_HOST:-redis}

function app_wait_redis {
  TIMEOUT=${2:-300}
  printf "Waiting for Redis service..."
  count=0
  until ( test_redis )
  do
    let "count=+1"
    if [ ${count} -gt $TIMEOUT ]
    then
      echo "Redis service didn't become ready in time"
      return 100
    fi
    sleep 1
    printf "."
  done
  printf "\n"
  echo "Redis service is ready!"
  return 0
}

function test_redis {
  redis-cli -h "${REDIS_HOST}" PING &>/dev/null
}

app_wait_redis
npm install
npm test
