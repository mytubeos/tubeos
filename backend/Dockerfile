FROM node:18

WORKDIR /app

COPY package*.json ./

# ✅ npm fix
RUN npm cache clean --force
RUN npm install --legacy-peer-deps

COPY . .

EXPOSE 8080

CMD ["npm", "start"]
