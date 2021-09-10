import express from 'express';
import axios from 'axios';
import graphql, { GraphQLError, GraphQLSchema } from 'graphql';
import { createProxyMiddleware } from 'http-proxy-middleware';
import fs from 'fs';

const PORT = process.env.PORT ?? 4000;
const PROXY_TARGET_URL = process.env.PROXY_TARGET_URL;
const GRAPHQL_SCHEMA_URL = process.env.GRAPHQL_SCHEMA_URL;
const GRAPHQL_SCHEMA_HEADERS = process.env.GRAPHQL_SCHEMA_HEADERS;
const OUTPUT_DIRECTORY = process.env.OUTPUT_DIRECTORY ?? 'logs';

console.log('Starting GraphQL Query Validator...');

if (!fs.existsSync(OUTPUT_DIRECTORY)) {
  fs.mkdirSync(OUTPUT_DIRECTORY);
}

console.log(`Fetching Schema from endpoint ${GRAPHQL_SCHEMA_URL}`);

const schema = await getSchema(GRAPHQL_SCHEMA_URL, GRAPHQL_SCHEMA_HEADERS);

console.log('Successfully executed introspection query. Starting up server...');

const app = express();

if (!PROXY_TARGET_URL) {
  console.log(`PROXY_TARGET_URL env var not set, starting up in passive mode.`);
  app.use(express.json());
  app.post('/', (req, res) => {
    try {
      const { validationErrors, operationNames } = validateGraphqlQuery(
        req.body.query,
        schema
      );

      if (validationErrors.length) {
        logErrors(query, operationNames, validationErrors);
      }

      res.status(200).json({
        query: req.body.query,
        operationNames,
        errors: validationErrors,
      });
    } catch (parsingError) {
      console.log(parsingError);
      res.status(400).json({ query: req.body.query, parsingError });
    }
  });
} else {
  console.log(
    `PROXY_TARGET_URL env var set, starting up in proxy mode to ${PROXY_TARGET_URL}`
  );
  app.use(
    createProxyMiddleware({
      target: PROXY_TARGET_URL,
      changeOrigin: true, // for vhosted sites
      onProxyReq: function validateQuery(proxyReq, req) {
        const body = [];
        req.on('data', (chunk) => {
          body.push(chunk);
        });
        req.on('end', () => {
          const parsedBody = Buffer.concat(body).toString();
          try {
            const query = JSON.parse(parsedBody).query;
            const { validationErrors, operationNames } = validateGraphqlQuery(
              query,
              schema
            );

            if (validationErrors.length) {
              logErrors(query, operationNames, validationErrors);
            }
          } catch (parsingError) {
            console.log(`[UNEXPECTED JSON PARSING ERROR]: ${parsingError}
[RAW REQUEST BODY]: ${parsedBody}`);
          }
        });
      },
    })
  );
}

app.listen(PORT, () => {
  console.log(`validation server started on port ${PORT}`);
});

function validateGraphqlQuery(stringQuery, schema) {
  const parsedQuery = graphql.parse(stringQuery);
  const validationErrors = graphql.validate(schema, parsedQuery);

  const operationNames = parsedQuery.definitions
    .filter((definition) => definition.kind === 'OperationDefinition')
    .map((definition) => definition?.name?.value ?? 'ANONYMOUS_OPERATION')
    .join('_');

  return { parsedQuery, validationErrors, operationNames };
}

/**
 * write the errors to disk
 * @param {string} stringOperations
 * @param {string} operationNames
 * @param {GraphQLError[]} validationErrors
 */
async function logErrors(stringOperations, operationNames, validationErrors) {
  const filename = `${Date.now()}_${operationNames}`;
  const log = `${filename}
ERROR ENCOUNTERED IN OPERATION ${operationNames}
TIMESTAMP: ${new Date().toLocaleString()}
--------------------------------------
${validationErrors.join('\n')}
--------------------------------------
END ERRORS. OPERATIONS START BELOW
--------------------------------------
${stringOperations}
--------------------------------------
`;

  fs.writeFile(`${OUTPUT_DIRECTORY}/${filename}.txt`, log, (err) => {
    if (err) {
      console.log(`Error writing to output file: ${err}`);
    }
  });
}

/**
 * used to fetch the graphql schema during initial boot of the server
 * @param {string} url string url to graphql endpoint
 * @param {string} headers json string object with auth headers necessary for access to endpoint
 * @returns a valid graphql schema
 */
async function getSchema(url, headers) {
  const response = await axios.post(
    url,
    {
      query: graphql.getIntrospectionQuery(),
    },
    {
      headers: {
        'content-type': 'application/json',
        ...JSON.parse(headers),
      },
    }
  );
  // TODO: check for and handle error
  if (response.data.errors?.length) {
    throw new Error(
      `Errors encountered while executing introspection query: ${response.data.errors.join(
        ', '
      )}`
    );
  }
  return graphql.buildClientSchema(response.data.data);
}
