
const socket = io();
let localStream;
let peers = {};
let username = localStorage.getItem("username") || "";

function joinRoom() {
  if (!username) return;

  navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    .then(stream => {
      localStream = stream;
      document.getElementById('micStatus').innerText = 'вкл';
      socket.emit('join-room', { roomId: "main", userId: username });
      socket.on('room-users', users => renderUsers(users));
      socket.on('message', appendMessage);
      socket.on('signal', async ({ from, data }) => {
        if (!peers[from]) {
          peers[from] = createPeer(from, false);
        }
        if (data.type === "offer") {
          await peers[from].setRemoteDescription(new RTCSessionDescription(data));
          const answer = await peers[from].createAnswer();
          await peers[from].setLocalDescription(answer);
          socket.emit('signal', { to: from, data: peers[from].localDescription });
        } else if (data.type === "answer") {
          await peers[from].setRemoteDescription(new RTCSessionDescription(data));
        } else if (data.candidate) {
          await peers[from].addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      });
    });
}

function createPeer(id, isInitiator) {
  const peer = new RTCPeerConnection();
  peer.ontrack = e => {
    const existing = document.getElementById('audio-' + id);
    if (!existing) {
      const audio = document.createElement('audio');
      audio.id = 'audio-' + id;
      audio.srcObject = e.streams[0];
      audio.autoplay = true;
      audio.controls = true;
      const container = document.createElement('div');
      container.appendChild(audio);
      const range = document.createElement('input');
      range.type = 'range';
      range.min = 0;
      range.max = 1;
      range.step = 0.01;
      range.value = 1;
      range.oninput = () => {
        audio.volume = range.value;
      };
      container.appendChild(range);
      document.getElementById('videoContainer').appendChild(container);
    }
  };
  if (localStream) {
    localStream.getTracks().forEach(track => peer.addTrack(track, localStream));
  }
  peer.onicecandidate = e => {
    if (e.candidate) {
      socket.emit('signal', { to: id, data: { candidate: e.candidate } });
    }
  };
  if (isInitiator) {
    peer.onnegotiationneeded = async () => {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket.emit('signal', { to: id, data: peer.localDescription });
    };
  }
  return peer;
}

function renderUsers(users) {
  const list = document.getElementById('userList');
  list.innerHTML = '';
  users.forEach(user => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="text-blue-400">${user}</span>
      <button onclick="remoteToggle('${user}', 'mic')" class="ml-2 text-xs bg-blue-700 px-2 py-1 rounded">🎙</button>
      <button onclick="remoteToggle('${user}', 'cam')" class="ml-1 text-xs bg-purple-700 px-2 py-1 rounded">📷</button>`;
    list.appendChild(li);
  });
}

function remoteToggle(user, type) {
  alert(`Функция управления ${type} пользователя ${user} может быть добавлена позже.`);
}

function toggleMic() {
  if (!localStream) return;
  const track = localStream.getAudioTracks()[0];
  if (!track) return;
  track.enabled = !track.enabled;
  document.getElementById('micStatus').innerText = track.enabled ? 'вкл' : 'выкл';
}

function toggleCam() {
  if (!localStream) return;
  const existing = localStream.getVideoTracks()[0];
  if (!existing) {
    navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
      const track = stream.getVideoTracks()[0];
      localStream.addTrack(track);
      const video = document.createElement('video');
      video.srcObject = new MediaStream([track]);
      video.autoplay = true;
      video.muted = true;
      video.className = "w-48 border border-white rounded";
      document.getElementById('videoContainer').appendChild(video);
      document.getElementById('camStatus').innerText = 'вкл';
    });
  } else {
    localStream.removeTrack(existing);
    existing.stop();
    document.getElementById('videoContainer').innerHTML = '';
    document.getElementById('camStatus').innerText = 'выкл';
  }
}

function sendMessage() {
  const input = document.getElementById('chatInput');
  if (input.value.trim()) {
    const message = input.value;
    socket.emit('message', { user: username, text: message, time: new Date().toLocaleTimeString() });
    input.value = '';
  }
}

function appendMessage({ user, text, time }) {
  const msg = document.createElement('div');
  msg.innerHTML = `<span class="text-green-400">${user}</span> <span class="text-gray-400 text-xs">[${time}]</span>: ${text}`;
  const container = document.getElementById('messages');
  container.appendChild(msg);
  container.scrollTop = container.scrollHeight;

  const history = JSON.parse(localStorage.getItem('chatHistory') || "[]");
  history.push({ user, text, time });
  localStorage.setItem('chatHistory', JSON.stringify(history.slice(-1000)));
}

function leaveRoom() {
  socket.disconnect();
  localStorage.removeItem("username");
  location.reload();
}

window.onload = () => {
  const stored = localStorage.getItem('username');
  if (stored) {
    username = stored;
    document.getElementById('authModal').style.display = 'none';
    joinRoom();
  }
  const history = JSON.parse(localStorage.getItem('chatHistory') || "[]");
  history.forEach(appendMessage);
}

function submitName() {
  const input = document.getElementById('username');
  if (!input || !input.value.trim()) return;
  const name = input.value.trim();
  localStorage.setItem('username', name);
  username = name;
  const auth = document.getElementById('authModal');
  if (auth) auth.style.display = 'none';
  joinRoom();
}
