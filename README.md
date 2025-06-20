# Voice Chat App

Простой веб-приложение с комнатой для голосового общения, реализованное на React + WebRTC + Socket.IO.

## 🚀 Запуск

1. Установите зависимости:
```bash
npm install
```

2. Запустите signaling-сервер:
```bash
node server.js
```

3. Запустите фронтенд:
```bash
npm run dev
```

## 🧪 Технологии

- React + Vite
- WebRTC (Simple-Peer)
- Socket.IO
- Express

## 🌐 Деплой

Можно развернуть через [Render](https://render.com) как два сервиса:
- `voice-chat-server` (сервер на Node.js, порт 3001)
- `voice-chat-frontend` (React-приложение с прокси на WebSocket)

