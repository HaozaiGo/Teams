FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages packages
RUN npm install
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/server packages/server
COPY --from=build /app/packages/web/dist packages/web/dist
RUN npm install --workspace=server --omit=dev
ENV PORT=4000
EXPOSE 4000
CMD ["npm", "run", "start", "-w", "server"]
