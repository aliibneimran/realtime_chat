import { useState } from 'react';
import Chatroom from './components/Chatroom';
import './App.css'

function App() {
  const [username, setUsername] = useState('');
  const [room, setRoom] = useState('');
  const [joined, setJoined] = useState(false);

  const joinRoom = (e) => {
    e.preventDefault();
    if (username.trim() && room.trim()) {
      setJoined(true);
    }
  };

  return (
    <div className='min-h-screen bg-gray-300 flex items-center justify-center'>
      {!joined ? (
        <div className='bg-white/90 backdrop-blur-sm p-8 rounded-2xl shadow-2xl w-full max-w-md transform transition-all hover:scale-[1.01]'>
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold text-gray-800 tracking-tight">Welcome Back</h1>
            <p className="text-gray-500 mt-2">Join a room to start chatting</p>
          </div>

          <form onSubmit={joinRoom} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1 ml-1">Your Name</label>
              <input
                type="text"
                placeholder="e.g. Anik"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:border-transparent outline-none transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1 ml-1">Room Name</label>
              <input
                type="text"
                placeholder="e.g. Gaming Zone"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:border-transparent outline-none transition-all"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95"
            >
              Join Chat Room
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-400 uppercase tracking-widest">Secure & Fast</p>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-lg animate-in fade-in zoom-in duration-300">
          <Chatroom username={username} room={room} />
        </div>
      )}
    </div>
  );
}

export default App;