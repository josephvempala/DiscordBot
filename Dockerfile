FROM node:16-alpine as builder
WORKDIR /app
COPY . .
RUN apk update
RUN apk add python3
RUN apk add build-base
ENV NODE_ENV=PRODUCTION
RUN npm i
RUN npm run build 

FROM node:16-alpine
WORKDIR /app
COPY --from=builder /app/dist .
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json .
COPY --from=builder /app/package-lock.json .
RUN apk add --no-cache ffmpeg
CMD ["node", "index.js"]
