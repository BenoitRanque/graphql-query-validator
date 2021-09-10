## GraphQL-Query-Validator

Simple nodejs server & container that can be used to validate queries
Has both a proxy mode and a passive mode.

In passive mode, will recieve requests and validate them, and log any errors.
In proxy mode, will also forward the request to the specified endpoint.

Must be provided an endpoint to query the schema to validate against.
Must also be provided the necessary headers to query that schema, in a JSON format.

Internally uses the graphql reference implementation for validation.

Will output logs of faulty queries to the logs directory.

#### Configuration

The container is configured with environment variables, described here

###### Environment Variables

The following environment variables are supported

```env
# internal port used by the container
PORT
# proxy target. if absent, will log errors and respond with results instead of proxing the requests
PROXY_TARGET_URL
# endpoint of the graphql schema to be used in validation
GRAPHQL_SCHEMA_URL
# auth headers used to access the graphql schema. must be a valid json string
GRAPHQL_SCHEMA_HEADERS
# output directory. default value "logs"
OUTPUT_DIRECTORY

```

###### .env file

The default configuration requires that a `.env` file be created in the root directory.
This file is gitignored and can contain sensitive information like admin secrets.

```env
# Target url for the proxy. By default the path is not altered, so this should be only the origin. Optional
PROXY_TARGET_URL=https://example.hasura.app/
# The full path to the graphql endpoint. Used for the introspection query. Mandatory
GRAPHQL_HASURA_ENDPOINT=https://example.hasura.app/v1/graphql
# Admin secret used for the introspection query. Mandatory
GRAPHQL_HASURA_ADMIN_SECRET=<admin-secret>
```

#### Development

Run `docker compose up -d` to start the development server.
The dev version of the server will start up, which will automatically restart when changes are made to js files in the `src` directory
If you add more dependencies, you must rebuild the server with `docker compose up -d --build`

#### Deployment

To build the container for deployment, run `docker compose -f docker-compose.yml build`.
The `docker-compose.override.yml` file includes dev specific configurations and should be ignored during deployment.

###### On build machine

```bash
# build image for production
docker-compose -f docker-compose.yml build
# find image id
docker images
# save image
docker save <IMAGE_ID> --output dist/<image.tag>.tar
```

###### On deployment machine

```bash
sudo docker load --input path/to/<image.tag>.tar
# find image id
sudo docker images
# tag image
sudo docker tag <IMAGE_ID> <image:tag>
```

The image can now be used by referencing it using the `<image:tag>` in the docker-compose file

#### Licence

MIT
