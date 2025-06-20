const socket = io();
let localStream;
const peers = {};
let micEnabled = true;
const audioElements = {};
const polite = {};

async function joinRoom() {
  const roomId = document.getElementById('roomId').value;
  const userId = document.getElementById('userId').value;
  if (!roomId || !userId) return alert('Введите комнату и имя');

  window.myUserId = userId;
  await setupMicrophone();
  socket.emit('join-room', { roomId, userId });

  socket.on('user-connected', (newUserId) => {
    if (!peers[newUserId]) {
      const peer = createPeer(newUserId);
      peers[newUserId] = peer;
    }
  });

  socket.on('signal', async ({ from, signal }) => {
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
          socket.emit('signal', {
            from: window.myUserId,
            to: from,
            signal: peer.localDescription
          });
        }
      } else if (desc.candidate) {
        await peer.addIceCandidate(desc);
      }
    } catch (e) {
      console.warn('💥 Ошибка сигналинга:', e);
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
    if (audioElements[userId]) {
      audioElements[userId].pause();
      audioElements[userId].remove();
      delete audioElements[userId];
    }
  });
}

function createPeer(remoteId) {
  const peer = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  });

  polite[remoteId] = remoteId > window.myUserId;
  peer.makingOffer = false;

  peer.onnegotiationneeded = async () => {
    try {
      peer.makingOffer = true;
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket.emit('signal', {
        from: window.myUserId,
        to: remoteId,
        signal: peer.localDescription
      });
    } catch (e) {
      console.warn('negotiation error:', e);
    } finally {
      peer.makingOffer = false;
    }
  };

  peer.onicecandidate = ({ candidate }) => {
    socket.emit('signal', {
      from: window.myUserId,
      to: remoteId,
      signal: candidate
    });
  };

  peer.ontrack = (event) => {
    const remoteStream = event.streams[0];
    if (remoteStream.id === localStream.id) return;

    if (!audioElements[remoteStream.id]) {
      const audio = document.createElement('audio');
      audio.autoplay = true;
      audio.controls = true;
      audio.volume = 1;
      audio.srcObject = remoteStream;
      document.body.appendChild(audio);
      audioElements[remoteStream.id] = audio;
    }
  };

  if (localStream) {
    localStream.getAudioTracks().forEach(track => {
      peer.addTrack(track.clone(), localStream);
    });
  }

  return peer;
}

async function setupMicrophone() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    console.log('🎤 Микрофон готов:', localStream);
  } catch (e) {
    console.error('🎤 Ошибка доступа к микрофону:', e);
  }
}

function toggleMic() {
  if (!localStream) return;
  micEnabled = !micEnabled;
  localStream.getAudioTracks().forEach(track => {
    track.enabled = micEnabled;
  });
  console.log('🔊 Микрофон:', micEnabled ? 'включен' : 'выключен');
}
