FROM node:20-alpine

WORKDIR /app
COPY package.json /app/package.json
RUN npm install --no-audit --no-fund

COPY server.js /app/server.js
COPY src /app/src

EXPOSE 8080
CMD ["node", "server.js"]

