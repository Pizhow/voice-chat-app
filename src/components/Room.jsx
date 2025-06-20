import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import Peer from "simple-peer";

const socket = io();

export function Room({ nickname, roomName }) {
  const [peers, setPeers] = useState({});
  const localStreamRef = useRef();
  const peersRef = useRef({});

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      localStreamRef.current.srcObject = stream;

      socket.emit("join-room", roomName);

      socket.on("user-joined", (userId) => {
        const peer = new Peer({ initiator: true, trickle: false, stream });
        peer.on("signal", (signal) => {
          socket.emit("signal", { to: userId, signal });
        });
        peer.on("stream", (userStream) => {
          addAudio(userId, userStream);
        });
        peersRef.current[userId] = peer;
      });

      socket.on("signal", ({ from, signal }) => {
        let peer = peersRef.current[from];
        if (!peer) {
          peer = new Peer({ initiator: false, trickle: false, stream });
          peer.on("signal", (signal) => {
            socket.emit("signal", { to: from, signal });
          });
          peer.on("stream", (userStream) => {
            addAudio(from, userStream);
          });
          peersRef.current[from] = peer;
        }
        peer.signal(signal);
      });

      socket.on("user-left", (userId) => {
        if (peersRef.current[userId]) {
          peersRef.current[userId].destroy();
          delete peersRef.current[userId];
          removeAudio(userId);
        }
      });
    });
  }, [roomName]);

  const addAudio = (id, stream) => {
    const audio = document.createElement("audio");
    audio.srcObject = stream;
    audio.autoplay = true;
    audio.id = id;
    document.body.appendChild(audio);
  };

  const removeAudio = (id) => {
    const el = document.getElementById(id);
    if (el) el.remove();
  };

  return (
    <div className="text-center">
      <h2 className="text-xl mb-4">Вы в комнате: {roomName}</h2>
      <audio ref={localStreamRef} autoPlay muted />
    </div>
  );
}