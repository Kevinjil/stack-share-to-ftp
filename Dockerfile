# Build in a different image to keep the target image clean
FROM node:12-alpine as build
WORKDIR /app
COPY ./package.json ./package-lock.json ./
RUN apk update && \
    apk add python2 make gcc g++ && \
    npm install
COPY ./ ./
RUN npm run build

# The target image that will be run
FROM node:12-alpine as target
EXPOSE 21
WORKDIR /app
COPY --from=build --chown=node /app/out/ ./
COPY ./package.json ./package-lock.json ./
RUN npm install --production
CMD ["node", "index.js", "21", "0.0.0.0"]
