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
      audioElements[userId].audio.pause();
      audioElements[userId].audio.remove();
      audioElements[userId].meter.remove();
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
      return;
    }

    // AUDIO элемент
    const audio = document.createElement('audio');
    audio.controls = true;
    audio.autoplay = true;
    audio.volume = 1.0;
    audio.srcObject = remoteStream;
    document.body.appendChild(audio);

    // METER элемент
    const meter = document.createElement('div');
    meter.textContent = '🔈 Уровень: ░░░░░░░░░░';
    meter.style.fontFamily = 'monospace';
    meter.style.marginBottom = '10px';
    document.body.appendChild(meter);

    // AudioContext + анализатор
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(remoteStream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    function drawMeter() {
      analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      const level = Math.min(10, Math.floor(avg / 10));
      meter.textContent = '🔈 Уровень: ' + '█'.repeat(level) + '░'.repeat(10 - level);
      requestAnimationFrame(drawMeter);
    }

    ctx.resume().then(() => {
      drawMeter();
    });

    audioElements[remoteStream.id] = { audio, meter };

    audio.play().then(() => {
      console.log('✅ Аудио участника воспроизводится');
    }).catch(err => {
      console.warn('⚠️ Ошибка воспроизведения потока:', err);
    });
  };

  if (localStream) {
    localStream.getTracks().forEach(track => {
      peer.addTrack(track, localStream);
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
