FROM node:20-alpine

WORKDIR /app

# Copia solo i file necessari per il backend
COPY package*.json ./

# Installa SOLO le dipendenze di produzione del backend
RUN npm install --omit=dev express cors bcryptjs jsonwebtoken

# Copia il file server
COPY backend/server.cjs ./backend/server.cjs

# Forziamo la porta 8181 come configurato in Railway
ENV PORT=8181
EXPOSE 8181

CMD ["node", "backend/server.cjs"]
