
let username = localStorage.getItem('username');

function submitName() {
  const input = document.getElementById('username');
  if (!input) {
    console.warn('Username input not found');
    return;
  }
  const name = input.value.trim();
  if (!name) return;

  localStorage.setItem('username', name);
  username = name;

  const auth = document.getElementById('authModal');
  if (auth) auth.style.display = 'none';

  const app = document.getElementById('app');
  if (app) app.style.display = 'block';

  if (typeof joinRoom === 'function') {
    joinRoom();
  } else {
    console.warn('joinRoom() not defined yet');
  }
}

function joinRoom() {
  console.log(`Пользователь ${username} подключается...`);
  // Здесь будет логика WebSocket
}
