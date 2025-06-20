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
          !peer.remoteDescription?.type
        ) {
          await peer.setRemoteDescription(new RTCSessionDescription(signal));
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
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
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
      console.log('Игнорируем собственный поток');
      return;
    }

    console.log('Получен поток от другого участника:', remoteStream);

    const audioTrack = remoteStream.getAudioTracks()[0];
    if (!audioTrack) {
      console.warn('❌ Нет аудиотрека в потоке');
    } else {
      console.log('🎤 Трек от участника:', audioTrack);
      console.log('enabled:', audioTrack.enabled, '| muted:', audioTrack.muted);

      audioTrack.onmute = () => console.warn('🔇 Участник замутился');
      audioTrack.onunmute = () => console.log('🔊 Участник включил звук');
    }

    let audio = audioElements[remoteStream.id];
    if (!audio) {
      audio = document.createElement('audio');
      audio.controls = true;
      audio.autoplay = true;
      audio.volume = 1.0;
      audioElements[remoteStream.id] = audio;
      document.body.appendChild(audio);
    }

    audio.srcObject = remoteStream;

    audio.play().then(() => {
      console.log('✅ Аудио участника воспроизводится');
    }).catch(err => {
      console.warn('⚠️ Ошибка воспроизведения потока:', err);
    });
  };

  if (localStream) {
    localStream.getTracks().forEach(track => {
      console.log('🟢 Добавляем трек:', track.kind, '| enabled:', track.enabled);
      peer.addTrack(track, localStream);
    });
    console.log('📤 Отправляемые треки:', peer.getSenders().map(s => s.track?.kind || 'null'));
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
    const track = localStream.getAudioTracks()[0];
    console.log('🎤 Локальный трек:', track);
    track.onmute = () => console.warn('🚫 Локальный трек замутился');
    track.onunmute = () => console.log('✅ Локальный трек активен');
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
