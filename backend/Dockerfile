
FROM node:18-bullseye

WORKDIR /app

COPY package*.json ./

# 🔥 stable install fix
RUN npm install --no-audit --no-fund

COPY . .

ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

CMD ["node", "server.js"]
