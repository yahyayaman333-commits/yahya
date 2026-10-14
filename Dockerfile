FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY --chown=node:node server ./server
COPY --chown=node:node src ./src
ENV HOST=0.0.0.0 PORT=8787 STORAGE_MODE=memory
USER node
EXPOSE 8787
CMD ["npm","start"]
