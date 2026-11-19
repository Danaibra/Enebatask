FROM node:20 AS web
WORKDIR /w
COPY frontend/package.json ./
RUN npm install
COPY frontend .
RUN npm run build
FROM golang:1.22 AS api
WORKDIR /b
COPY backend .
RUN CGO_ENABLED=0 go build -o server .
FROM alpine:3.20
WORKDIR /app
COPY --from=api /b/server .
COPY --from=web /w/dist ./static
CMD ["./server"]
