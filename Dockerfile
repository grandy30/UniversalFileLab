FROM node:20-alpine
WORKDIR /app
COPY server/package*.json ./server/
RUN cd server && npm install
COPY server ./server
WORKDIR /app/server
EXPOSE 5000
CMD ["node", "server.js"]
