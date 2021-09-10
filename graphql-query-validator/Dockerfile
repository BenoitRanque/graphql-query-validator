FROM node:16-slim

# Create app directory
WORKDIR /usr/app

# set app directoy ownership to user node of group node
RUN chown -R node:node .

# change user
USER node

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package.json ./

# build time argument to add tools for development
ARG NODE_ENV=production
ARG PORT=80

# global install needs root privileges. Only installed during development
RUN npm install

USER root

# COPY always copies files as root. change owner after copy
COPY ./src ./src
RUN chown -R node:node ./src/*

USER node

EXPOSE ${PORT}
CMD [ "npm", "run", "prod" ]