FROM node:21-alpine as builder
WORKDIR /app
COPY . .
RUN apk update
RUN apk add python3
RUN apk add build-base
ENV NODE_ENV=PRODUCTION
RUN npm i
RUN npm run build 

FROM node:21-alpine
WORKDIR /app
COPY --from=builder /app/dist .
COPY --from=builder /app/node_modules ./node_modules
RUN apk add --no-cache ffmpeg
CMD ["node", "index.js"]
