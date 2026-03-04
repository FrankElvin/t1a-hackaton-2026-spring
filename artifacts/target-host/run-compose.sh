#!/bin/bash

docker compose -f ./artifacts/target-host/docker-compose.yaml --env-file .env up --build -d

