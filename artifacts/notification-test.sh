
# Step 0 — Set variables or export it from outside
#export USERNAME=
#export PASSWORD=

export KEYCLOAK_URL_BASE=http://localhost:9090
export BACKEND_URL_BASE=http://localhost:8081

#export KEYCLOAK_URL_BASE=https://keycloak.t1aclmllmagents.click
#export BACKEND_URL_BASE=http://t1aclmllmagents.click:8081

export CHECK_DATE=2026-03-25T00:00:00Z

if [[ -z "$USERNAME" ]]; then
  echo "Error: The environment variable USERNAME must be set."
  exit 1
fi

if [[ -z "$PASSWORD" ]]; then
  echo "Error: The environment variable PASSWORD must be set."
  exit 1
fi

if [[ -z "$KEYCLOAK_URL_BASE" ]]; then
  echo "Error: The environment variable KEYCLOAK_URL_BASE must be set."
  exit 1
fi

if [[ -z "$BACKEND_URL_BASE" ]]; then
  echo "Error: The environment variable BACKEND_URL_BASE must be set."
  exit 1
fi

echo "Calling app by curl $BACKEND_URL_BASE; user: $USERNAME"

# Step 1 — Get a JWT token from Keycloak
TOKEN=$(curl -s -X POST \
  $KEYCLOAK_URL_BASE/realms/neverempty/protocol/openid-connect/token \
  -d "grant_type=password" \
  -d "client_id=household-ui" \
  -d "username=$USERNAME" \
  -d "password=$PASSWORD" \
  | jq -r .access_token)

echo "Token obtained: $TOKEN"
#  This requires Direct access grants to be enabled on the household-ui client in Keycloak admin (http://localhost:9090 → realm neverempty → Clients → household-ui → Settings). If it's not enabled, grab the token from the
#  browser instead: open DevTools → Network → any /api/v1/ request → copy the Authorization: Bearer ... header value.
#
#  Step 2 — Find your userId (it's the sub claim in the JWT)
#
USER_ID=$(echo $TOKEN | cut -d. -f2 | base64 -d 2>/dev/null | jq -r .sub)

#  Step 3 — Trigger the notification
#
curl -s -X POST $BACKEND_URL_BASE/api/v1/notifications/trigger \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"userId\": \"$USER_ID\",
    \"checkDate\": \"$CHECK_DATE\",
    \"ignorePrevNotification\": true
  }"

#  Expected response:
#  {"status": "triggered"}
#
#  ---
#  All three steps as a one-liner (if you already have jq):
#
#  TOKEN=$(curl -s -X POST http://localhost:9090/realms/neverempty/protocol/openid-connect/token \
#    -d "grant_type=password" -d "client_id=household-ui" \
#    -d "username=YOUR_USERNAME" -d "password=YOUR_PASSWORD" | jq -r .access_token) && \
#  USER_ID=$(echo $TOKEN | cut -d. -f2 | base64 -d 2>/dev/null | jq -r .sub) && \
#  curl -s -X POST http://localhost:8081/api/v1/notifications/trigger \
#    -H "Authorization: Bearer $TOKEN" \
#    -H "Content-Type: application/json" \
#    -d "{\"userId\":\"$USER_ID\",\"checkDate\":\"2026-03-20T00:00:00Z\",\"ignorePrevNotification\":true}"
#
#  Replace YOUR_USERNAME, YOUR_PASSWORD, and the checkDate value as needed.
