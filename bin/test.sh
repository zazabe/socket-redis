#!/bin/bash -e

source "/var/lib/docker/utils.sh"

wait_services redis
npm install
npm test
