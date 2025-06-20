const socket = io();
let localStream;
const peers = {};
let micEnabled = true;
const audioElements = {};

async function joinRoom() {
  const roomId = document.getElementById('roomId').value;
  const userId = document.getElementById('userId').value;
  if (!roomId || !userId) return alert('Введите комнату и имя');

  window.myUserId = userId;
  await setupMicrophone();
  socket.emit('join-room', { roomId, userId });

  socket.on('user-connected', (newUserId) => {
    if (!peers[newUserId]) {
      const peer = createPeer(newUserId, true);
      peers[newUserId] = peer;
    }
  });

  socket.on('signal', async ({ from, signal }) => {
    let peer = peers[from];
    if (!peer) {
      peer = createPeer(from, false);
      peers[from] = peer;
    }

    try {
      if (signal.type === 'offer') {
        if (peer.signalingState === 'stable') {
          await peer.setRemoteDescription(new RTCSessionDescription(signal));
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          socket.emit('signal', {
            roomId: document.getElementById('roomId').value,
            from: window.myUserId,
            to: from,
            signal: peer.localDescription
          });
        }
      } else if (signal.type === 'answer') {
        if (
          peer.signalingState === 'have-local-offer' &&
          !peer.remoteDescription
        ) {
          await peer.setRemoteDescription(new RTCSessionDescription(signal));
        } else {
          console.warn('❗ Ответ уже обработан или peer не в нужном состоянии. Пропускаем.');
        }
      } else if (signal.candidate) {
        if (peer.remoteDescription) {
          await peer.addIceCandidate(signal);
        }
      }
    } catch (e) {
      console.warn('Ошибка WebRTC:', e);
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

function createPeer(remoteId, initiator = true) {
  const peer = new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ]
  });

  peer.onicecandidate = (e) => {
    if (e.candidate) {
      socket.emit('signal', {
        from: window.myUserId,
        to: remoteId,
        signal: e.candidate
      });
    }
  };

  peer.ontrack = (e) => {
    const remoteStream = e.streams[0];
    if (remoteStream.id === localStream.id) {
      console.log('⚠️ Игнорируем собственный поток');
      return;
    }

    const audio = document.createElement('audio');
    audio.controls = true;
    audio.autoplay = true;
    audio.volume = 1.0;
    audio.srcObject = remoteStream;
    document.body.appendChild(audio);
    audioElements[remoteStream.id] = audio;

    audio.play().then(() => {
      console.log('✅ Аудио участника воспроизводится');
    }).catch(err => {
      console.warn('⚠️ Ошибка воспроизведения потока:', err);
    });
  };

  if (localStream) {
    localStream.getAudioTracks().forEach(track => {
      const clonedTrack = track.clone();
      peer.addTrack(clonedTrack, localStream);
    });
  }

  if (initiator) {
    peer.createOffer().then(offer => {
      peer.setLocalDescription(offer);
      socket.emit('signal', {
        from: window.myUserId,
        to: remoteId,
        signal: offer
      });
    });
  }

  return peer;
}

async function setupMicrophone() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    console.log('🎙️ Микрофон доступен:', localStream);
  } catch (e) {
    console.error('❌ Ошибка доступа к микрофону:', e);
    alert('Микрофон не работает!');
  }
}

function toggleMic() {
  if (!localStream) return;
  micEnabled = !micEnabled;
  localStream.getAudioTracks().forEach(track => {
    track.enabled = micEnabled;
  });
  console.log('🎚️ Микрофон:', micEnabled ? 'включен' : 'выключен');
}
