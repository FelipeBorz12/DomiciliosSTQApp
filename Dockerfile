FROM node:20-alpine

WORKDIR /app

# Instala dependencias
COPY package*.json ./
RUN npm ci

# Copia código y compila
COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3005

EXPOSE 3005
CMD ["npm","run","start"]
