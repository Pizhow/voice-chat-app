import React, { useState } from "react";
import { Room } from "./components/Room";

export default function App() {
  const [nickname, setNickname] = useState("");
  const [joined, setJoined] = useState(false);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      {!joined ? (
        <div className="bg-gray-800 p-6 rounded-2xl shadow-xl space-y-4">
          <h1 className="text-2xl font-bold">Вход в комнату</h1>
          <input
            type="text"
            placeholder="Введите ник"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="p-2 rounded w-full text-black"
          />
          <button
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded w-full"
            onClick={() => nickname && setJoined(true)}
          >
            Присоединиться к комнате
          </button>
        </div>
      ) : (
        <Room nickname={nickname} roomName="room1" />
      )}
    </div>
  );
}