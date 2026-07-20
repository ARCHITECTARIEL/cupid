FROM node:20-slim

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=7860

RUN apt-get update \
    && apt-get install -y --no-install-recommends git tini \
    && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 7860
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server.js"]
