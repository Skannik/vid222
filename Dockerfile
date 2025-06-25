FROM node:18

WORKDIR /app

# Сначала копируем весь проект
COPY . .

# Устанавливаем зависимости клиента и билдим клиент
WORKDIR /app/client
RUN npm install
RUN npm run build

# Устанавливаем зависимости сервера
WORKDIR /app/server
RUN npm install

# Копируем build клиента в сервер (на всякий случай)
RUN rm -rf /app/server/build && cp -r /app/client/build /app/server/build

WORKDIR /app/server

EXPOSE 8080

CMD ["npm", "run", "start"]
