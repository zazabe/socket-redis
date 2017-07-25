#!/bin/bash -e

wait-for-it redis:6379
npm install
npm test
