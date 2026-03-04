#!/bin/bash

docker compose --project-directory . -f ./artifacts/target-host/docker-compose.yaml --env-file .env up --build -d

