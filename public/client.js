const socket = io();
let localStream;
const peers = {};

async function joinRoom() {
  const roomId = document.getElementById('roomId').value;
  const userId = document.getElementById('userId').value;
  if (!roomId || !userId) return alert('Введите комнату и имя');

  socket.emit('join-room', { roomId, userId });
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });

  socket.on('user-connected', (newUserId) => {
    const peer = createPeer(newUserId);
    peers[newUserId] = peer;
  });

  socket.on('signal', async ({ from, signal }) => {
    if (signal.type === 'offer') {
      const peer = createPeer(from, false);
      peers[from] = peer;
      await peer.setRemoteDescription(signal);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.emit('signal', { roomId, from: userId, to: from, signal: peer.localDescription });
    } else if (signal.type === 'answer') {
      await peers[from].setRemoteDescription(signal);
    } else if (signal.candidate) {
      await peers[from].addIceCandidate(signal);
    }
  });

  socket.on('room-users', (users) => {
    const list = document.getElementById('userList');
    list.innerHTML = '';
    users.forEach(u => {
      const li = document.createElement('li');
      li.textContent = u;
      list.appendChild(li);
    });
  });

  socket.on('user-disconnected', (userId) => {
    if (peers[userId]) peers[userId].close();
    delete peers[userId];
  });
}

function createPeer(remoteId, initiator = true) {
  const peer = new RTCPeerConnection();

  peer.onicecandidate = (e) => {
    if (e.candidate) {
      socket.emit('signal', { from: document.getElementById('userId').value, to: remoteId, signal: e.candidate });
    }
  };

  peer.ontrack = (e) => {
    const audio = document.createElement('audio');
    audio.srcObject = e.streams[0];
    audio.autoplay = true;
    document.body.appendChild(audio);
  };

  localStream.getTracks().forEach(track => peer.addTrack(track, localStream));

  if (initiator) {
    peer.createOffer().then(offer => {
      peer.setLocalDescription(offer);
      socket.emit('signal', { from: document.getElementById('userId').value, to: remoteId, signal: offer });
    });
  }

  return peer;
}