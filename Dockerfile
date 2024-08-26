FROM node:21-alpine AS builder
ARG BUILDPLATFORM
WORKDIR /app
RUN apk update
RUN apk add python3
RUN apk add build-base
ENV NODE_ENV=PRODUCTION
COPY package.json package.json
COPY package-lock.json package-lock.json
RUN npm i
COPY . .
RUN npm run build
RUN npm run getytdlp

FROM node:21-alpine
WORKDIR /app
RUN apk add --no-cache ffmpeg
COPY --from=builder /app/dist .
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "index.js"]
