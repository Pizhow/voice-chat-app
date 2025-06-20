const socket = io();
let localStream;
const peers = {};
let micEnabled = true;

async function joinRoom() {
  const roomId = document.getElementById('roomId').value;
  const userId = document.getElementById('userId').value;
  if (!roomId || !userId) return alert('Введите комнату и имя');

  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  console.log('Микрофон доступен:', localStream);
  socket.emit('join-room', { roomId, userId });

  socket.on('user-connected', (newUserId) => {
    const peer = createPeer(newUserId);
    peers[newUserId] = peer;
  });

  socket.on('signal', async ({ from, signal }) => {
    if (!peers[from]) {
      peers[from] = createPeer(from, false);
    }

    const peer = peers[from];

    if (signal.type === 'offer') {
      await peer.setRemoteDescription(new RTCSessionDescription(signal));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.emit('signal', {
        roomId,
        from: userId,
        to: from,
        signal: peer.localDescription
      });
    } else if (signal.type === 'answer') {
      if (peer.signalingState !== 'stable') {
        await peer.setRemoteDescription(new RTCSessionDescription(signal));
      }
    } else if (signal.candidate) {
      try {
        await peer.addIceCandidate(signal);
      } catch (e) {
        console.warn('Ошибка ICE-кандидата:', e);
      }
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
  const peer = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  });

  peer.onicecandidate = (e) => {
    if (e.candidate) {
      socket.emit('signal', {
        from: document.getElementById('userId').value,
        to: remoteId,
        signal: e.candidate
      });
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
      socket.emit('signal', {
        from: document.getElementById('userId').value,
        to: remoteId,
        signal: offer
      });
    });
  }

  return peer;
}

function toggleMic() {
  if (!localStream) return;
  micEnabled = !micEnabled;
  localStream.getAudioTracks().forEach(track => {
    track.enabled = micEnabled;
  });
  console.log('Микрофон:', micEnabled ? 'включен' : 'выключен');
}
