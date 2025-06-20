
const socket = io();
let localStream;
let micEnabled = true;
let camEnabled = true;
let joined = false;
const peers = {};
const audioElements = {};
const videoElements = {};
const polite = {};

function joinRoom() {
  const userId = document.getElementById('userId').value;
  if (!userId || joined) return;
  joined = true;
  window.myUserId = userId;
  setupMedia();
  socket.emit('join', userId);

  socket.on('user-connected', (newUserId) => {
    if (!peers[newUserId]) {
      const peer = createPeer(newUserId);
      peers[newUserId] = peer;
    }
  });

  socket.on('signal', async ({ from, signal }) => {
    if (!signal) return;
    const peer = peers[from] || createPeer(from);
    peers[from] = peer;
    const desc = signal;
    const isOffer = desc.type === 'offer';
    const readyForOffer = !peer.currentRemoteDescription &&
                          (peer.signalingState === 'stable' || peer.signalingState === 'have-local-offer');
    const offerCollision = isOffer && (peer.makingOffer || !readyForOffer);
    const ignoreOffer = !polite[from] && offerCollision;
    if (ignoreOffer) return;
    try {
      if (desc.type) {
        await peer.setRemoteDescription(desc);
        if (desc.type === 'offer') {
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          socket.emit('signal', { from: window.myUserId, to: from, signal: peer.localDescription });
        }
      } else if (desc.candidate) {
        await peer.addIceCandidate(desc);
      }
    } catch (e) {}
  });

  socket.on('users', (users) => {
    const list = document.getElementById('userList');
    list.innerHTML = '<b>Участники:</b>';
    users.forEach(u => {
      const li = document.createElement('li');
      li.textContent = u;
      list.appendChild(li);
    });
  });

  socket.on('user-disconnected', (userId) => {
    if (peers[userId]) peers[userId].close();
    delete peers[userId];
    ['audio', 'video'].forEach(type => {
      const el = (type === 'audio' ? audioElements : videoElements)[userId];
      if (el) {
        el.pause?.();
        el.remove();
        delete (type === 'audio' ? audioElements : videoElements)[userId];
      }
    });
  });

  socket.on('chat-message', ({ from, text }) => {
    const messages = document.getElementById('messages');
    const div = document.createElement('div');
    div.textContent = `${from}: ${text}`;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  });
}

function leaveRoom() {
  window.location.reload();
}

function createPeer(remoteId) {
  const peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  polite[remoteId] = remoteId > window.myUserId;
  peer.makingOffer = false;
  peer.onnegotiationneeded = async () => {
    try {
      peer.makingOffer = true;
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket.emit('signal', { from: window.myUserId, to: remoteId, signal: peer.localDescription });
    } catch (e) {} finally { peer.makingOffer = false; }
  };
  peer.onicecandidate = ({ candidate }) => {
    socket.emit('signal', { from: window.myUserId, to: remoteId, signal: candidate });
  };
  peer.ontrack = (event) => {
    const remoteStream = event.streams[0];
    if (remoteStream.id === localStream.id) return;
    const audio = document.createElement('audio');
    audio.autoplay = true;
    audio.srcObject = remoteStream;
    document.body.appendChild(audio);
    audioElements[remoteStream.id] = audio;
    const video = document.createElement('video');
    video.autoplay = true;
    video.srcObject = remoteStream;
    video.style.width = '200px';
    document.body.appendChild(video);
    videoElements[remoteStream.id] = video;
  };
  if (localStream) {
    localStream.getTracks().forEach(track => {
      peer.addTrack(track.clone(), localStream);
    });
  }
  return peer;
}

async function setupMedia() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    const video = document.createElement('video');
    video.srcObject = localStream;
    video.autoplay = true;
    video.muted = true;
    video.style.width = '200px';
    document.body.appendChild(video);
  } catch (e) {
    console.error('Ошибка доступа к медиа:', e);
  }
}

function toggleMic() {
  if (!localStream) return;
  micEnabled = !micEnabled;
  localStream.getAudioTracks().forEach(track => track.enabled = micEnabled);
  document.getElementById('micStatus').textContent = micEnabled ? 'вкл' : 'выкл';
}

function toggleCam() {
  if (!localStream) return;
  camEnabled = !camEnabled;
  localStream.getVideoTracks().forEach(track => track.enabled = camEnabled);
  document.getElementById('camStatus').textContent = camEnabled ? 'вкл' : 'выкл';
}

function sendMessage() {
  const input = document.getElementById('chatInput');
  const text = input.value;
  if (text.trim()) {
    socket.emit('chat-message', { from: window.myUserId, text });
    input.value = '';
  }
}
