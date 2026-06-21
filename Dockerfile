FROM node:20-alpine

WORKDIR /app

# backend ki dependencies install karo
COPY backend/package*.json ./

RUN npm install --production

# backend ka saara code copy karo
COPY backend/ .

# Cloud Run PORT env variable use karta hai
EXPOSE 8080

CMD ["node", "server.js"]

