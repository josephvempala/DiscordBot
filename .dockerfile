FROM node:current-alpine
WORKDIR /app
COPY . .
RUN npm install
CMD ["npm","run","start"]