# hackaton-2025-new-team-1

## Project: NeverEmpty

There likely will be an app for careful planners of household resources.

[Demo app URL](https://t1aclmllmagents.click)

For judges: `I_PROMISE_I_DIDNT_PRE_CODE_THIS`

### Places of interest:

 - [Various artifacts made during the preparation phase. Most of them had been made manually](./humans)
   * [Result of initial planning session, including rough ideas and a project plan](./humans/requirements-v01.drawio)
   * [Presentation we used for the demo](./humans/never_empty_pitch.pptx)
 - [Initial and naive version of database schema, partially discarded](./schema)


#### Running on localhost
Check out [artifacts/deploy-localhost.md](artifacts/deploy-localhost.md) and [artifacts/example-localhost.env](artifacts/example-localhost.env) files.
To deploy the app locally:
1. In the project root run `cp ./artifacts/example-localhost.env ./.env`
2. Fill the variables in the .env file and follow the guide


#### Running on a public VM with DNS record
Running on a public VM requires more hustle as public addresses should be correctly set in the documentation.
Checkout the [artifacts/deploy-localhost.md](artifacts/deploy-vm.md) for general guidance.

To deploy the app:
1. Assuming a local deployment exercise was done. If not, inspect the previous section.
2. Inspect the [./artifacts/target-host/example.env](./artifacts/target-host/example.env) and [artifacts/target-host/docker-compose.yaml](artifacts/target-host/docker-compose.yaml) files to see the difference compared to normal ones. 
3. Upload code to the target machine
4. In the project root run `cp ./artifacts/target-host/example.env ./.env` 
5. Fill the variables in the .env file
6. Follow the guide to deploy the app, starting the app by running `./artifacts/target-host/run-compose.sh` instead of simple docker compose start

