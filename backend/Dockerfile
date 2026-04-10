FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev || (echo "npm install FAILED" && exit 1)

COPY . .

EXPOSE 8080

CMD ["node", "backend/server.js"]
