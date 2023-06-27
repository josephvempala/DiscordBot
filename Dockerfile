FROM node:16-alpine as builder
WORKDIR /app
COPY . .
RUN apk update
RUN apk add python3
RUN apk add build-base
RUN npm install
RUN npm run build 

FROM node:16-alpine
WORKDIR /app
COPY --from=builder /app/dist .
COPY --from=builder /app/package.json .
RUN apk add python3
RUN apk add build-base
RUN npm install --omit=dev
RUN apk add --no-cache ffmpeg
CMD ["node", "index.js"]
