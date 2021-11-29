FROM node:16-alpine as builder
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build

FROM node:16-alpine
WORKDIR /app
COPY --from=builder /app/dist/app.js .
EXPOSE 5001
CMD ["node", "app.js"]
