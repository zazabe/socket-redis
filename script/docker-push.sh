#!/bin/bash -e
BUILD="${TRAVIS_REPO_SLUG}:build"
TARGET="${1:-${TRAVIS_REPO_SLUG}:${TRAVIS_TAG}"

docker login -u="${DOCKER_USERNAME}" -p="${DOCKER_PASSWORD}"
docker build . -t "${BUILD}"
docker tag "${BUILD}" "${TARGET}"
docker push "${TARGET}"
