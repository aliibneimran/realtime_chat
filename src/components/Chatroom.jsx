import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import PropTypes from 'prop-types';

// const socket = io.connect('http://localhost:3000');
const socket = io.connect('https://my-chat-server-n34m.onrender.com');
const Chatroom = ({ username, room }) => {
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([]);
    const [typingMessage, setTypingMessage] = useState('');
    const messagesEndRef = useRef(null);
    
    // Audio Call States
    const [isCalling, setIsCalling] = useState(false);
    const [incomingCall, setIncomingCall] = useState(null);
    const [localStream, setLocalStream] = useState(null);
    const pc = useRef(null);
    const remoteAudioRef = useRef(null);

    const [callDuration, setCallDuration] = useState(0); // সেকেন্ডে সময়
    const timerRef = useRef(null);
    const ringtoneRef = useRef(new Audio('/ringing.mp3')); // রিংটোন ফাইল
   // টাইমার স্টার্ট করার ফাংশন
    const startTimer = () => {
        setCallDuration(0);
        timerRef.current = setInterval(() => {
            setCallDuration((prev) => prev + 1);
        }, 1000);
    };

    // টাইমার স্টপ করার ফাংশন
    const stopTimer = () => {
        clearInterval(timerRef.current);
        setCallDuration(0);
    };

    // সময়কে ফরম্যাট করার ফাংশন (00:00)
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };
    // রিংটোন বাজানো এবং বন্ধ করা
    useEffect(() => {
        if (incomingCall) {
            ringtoneRef.current.loop = true;
            ringtoneRef.current.play().catch(e => console.log("Audio play deferred"));
        } else {
            ringtoneRef.current.pause();
            ringtoneRef.current.currentTime = 0;
        }
    }, [incomingCall]);
    useEffect(() => {
        socket.emit('join_room', room);

        socket.on('receive_message', (data) => {
            setMessages((prev) => [...prev, data]);
        });

        socket.on('user_typing', (user_name) => {
            if (user_name !== username) {
                setTypingMessage(`${user_name} is typing...`);
                const timer = setTimeout(() => { setTypingMessage(''); }, 2000);
                return () => clearTimeout(timer);
            }
        });

        // WebRTC Signaling Events
        socket.on('call_incoming', (data) => setIncomingCall(data));
        
        socket.on('call_accepted', async (signal) => {
            await pc.current.setRemoteDescription(new RTCSessionDescription(signal));
            startTimer();
        });

        socket.on('ice_candidate', async (data) => {
            if (pc.current && data.candidate) {
                try {
                    await pc.current.addIceCandidate(new RTCIceCandidate(data.candidate));
                } catch (e) { console.error("Error adding ice candidate", e); }
            }
        });

        socket.on('call_ended', () => stopCall(false));

        return () => {
            socket.off('receive_message');
            socket.off('user_typing');
            socket.off('call_incoming');
            socket.off('call_accepted');
            socket.off('ice_candidate');
            socket.off('call_ended');
        };
    }, [room, username]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, typingMessage]);

    // --- WebRTC Functions ---

    const createPeerConnection = (stream) => {
        pc.current = new RTCPeerConnection({
            iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' },
        ]
        });

        stream.getTracks().forEach(track => pc.current.addTrack(track, stream));

        pc.current.ontrack = (event) => {
            if (remoteAudioRef.current) {
                remoteAudioRef.current.srcObject = event.streams[0];
            }
        };

        pc.current.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice_candidate', { room, candidate: event.candidate });
            }
        };
    };

    const startCall = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setLocalStream(stream);
            setIsCalling(true);
            createPeerConnection(stream);
            const offer = await pc.current.createOffer();
            await pc.current.setLocalDescription(offer);
            socket.emit('call_user', { room, signal: offer, from: username });
        } catch (err) { console.error("Failed to get local stream", err); }
    };

    const acceptCall = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setLocalStream(stream);
            createPeerConnection(stream);
            await pc.current.setRemoteDescription(new RTCSessionDescription(incomingCall.signal));
            const answer = await pc.current.createAnswer();
             startTimer();
            await pc.current.setLocalDescription(answer);
            socket.emit('answer_call', { room, signal: answer });
            setIncomingCall(null);
            setIsCalling(true);
        } catch (err) { console.error("Failed to accept call", err); }
    };

    const stopCall = (emitEvent = true) => {
        if (emitEvent) socket.emit('end_call', room);
        if (localStream) localStream.getTracks().forEach(track => track.stop());
        if (pc.current) pc.current.close();
        stopTimer();
        setIsCalling(false);
        setIncomingCall(null);
        setLocalStream(null);
    };

    // --- Chat Functions ---

    const sendMessage = () => {
        if (message.trim()) {
            const messageData = {
                room, author: username, message,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                id: Math.random().toString(36).substr(2, 9)
            };
            socket.emit('send_message', messageData);
            setMessages((prev) => [...prev, messageData]);
            setMessage('');
        }
    };

    const sendImage = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                const messageData = {
                    room, author: username, image: reader.result, type: 'image',
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    id: Math.random().toString(36).substr(2, 9)
                };
                socket.emit('send_message', messageData);
                setMessages((prev) => [...prev, messageData]);
            };
            reader.readAsDataURL(file);
        }
    };

    return (
       <div className="flex flex-col h-screen w-full max-w-2xl mx-auto bg-white md:h-[90vh] md:my-5 md:rounded-3xl md:shadow-2xl overflow-hidden relative border-slate-200 border">
            
            {/* Header: Fixed Height */}
            <header className="px-4 py-3 flex justify-between items-center border-b bg-white/80 backdrop-blur-md sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold shadow-lg">
                        {room[0].toUpperCase()}
                    </div>
                    <div className="overflow-hidden">
                        <h2 className="font-bold text-slate-800 text-sm md:text-base truncate capitalize">Room: {room}</h2>
                        {isCalling ? (
                            <p className="text-[10px] text-indigo-600 font-bold animate-pulse">📞 {formatTime(callDuration)}</p>
                        ) : (
                            <p className="text-[10px] text-green-500 font-medium">● Online</p>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button onClick={isCalling ? () => stopCall(true) : startCall} 
                        className={`p-2.5 rounded-full transition-all ${isCalling ? 'bg-red-500 text-white animate-pulse' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                    </button>
                    <div className="hidden sm:block text-right border-l pl-3">
                        <span className="text-[10px] text-slate-400 block uppercase">User</span>
                        <span className="text-xs font-bold text-indigo-600 capitalize">{username}</span>
                    </div>
                </div>
            </header>

            {/* Incoming Call Overlay */}
            {incomingCall && (
                <div className="absolute inset-x-0 top-0 bottom-0 bg-slate-900/90 z-50 flex flex-col items-center justify-center p-6 text-white backdrop-blur-sm">
                    <div className="w-24 h-24 bg-indigo-500 rounded-full flex items-center justify-center mb-6 animate-pulse ring-8 ring-indigo-500/30">
                        <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24"><path d="M20 15.5c-1.2 0-2.4-.2-3.6-.6-.3-.1-.7 0-1 .2l-2.2 2.2c-2.8-1.4-5.1-3.8-6.6-6.6l2.2-2.2c.3-.3.4-.7.2-1-.3-1.1-.5-2.3-.5-3.5 0-.6-.4-1-1-1H4c-.6 0-1 .4-1 1 0 9.4 7.6 17 17 17 .6 0 1-.4 1-1v-3.5c0-.6-.4-1-1-1z"/></svg>
                    </div>
                    <h3 className="text-2xl font-bold mb-1">{incomingCall.from}</h3>
                    <p className="text-indigo-300 mb-10">Incoming audio call...</p>
                    <div className="flex gap-6 w-full max-w-xs">
                        <button onClick={acceptCall} className="flex-1 bg-green-500 h-14 rounded-2xl font-bold text-lg shadow-lg shadow-green-500/40">Accept</button>
                        <button onClick={() => { stopCall(true); setIncomingCall(null); }} className="flex-1 bg-red-500 h-14 rounded-2xl font-bold text-lg shadow-lg shadow-red-500/40">Decline</button>
                    </div>
                </div>
            )}

            <audio ref={remoteAudioRef} autoPlay />

            {/* Message List: Scrollable */}
            <main className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50 custom-scrollbar">
                {messages.map((msg) => {
                    const isMe = msg.author === username;
                    return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] sm:max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                                {!isMe && <span className="text-[10px] font-bold text-slate-400 mb-1 ml-1 uppercase">{msg.author}</span>}
                                <div className={`px-2 py-2 rounded-2xl shadow-sm text-sm ${isMe ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-slate-700 rounded-tl-none border border-slate-200'}`}>
                                    {msg.type === 'image' ? <img src={msg.image} alt="sent" className="rounded-lg max-h-64 object-contain" /> : <p>{msg.message}</p>}
                                    <p className={`text-[9px] mt-1 text-right ${isMe ? 'text-indigo-200' : 'text-slate-400'}`}>{msg.timestamp}</p>
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </main>

            {/* Typing Indicator */}
            <div className="px-4 h-4 bg-slate-50">
                {typingMessage && <span className="text-[10px] italic text-slate-400 animate-pulse">{typingMessage}</span>}
            </div>

            {/* Input Footer: Sticky at bottom */}
            <footer className="p-3 bg-white border-t border-slate-100 pb-safe">
                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl focus-within:ring-2 focus-within:ring-indigo-400 focus-within:bg-white transition-all">
                    <label className="p-2 text-slate-500 hover:text-indigo-600 cursor-pointer">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                                const reader = new FileReader();
                                reader.onload = () => {
                                    const data = { room, author: username, image: reader.result, type: 'image', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), id: Date.now() };
                                    socket.emit('send_message', data);
                                    setMessages(prev => [...prev, data]);
                                };
                                reader.readAsDataURL(file);
                            }
                        }} />
                    </label>
                    <input
                        type="text"
                        className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2 px-1"
                        value={message}
                        onChange={(e) => { setMessage(e.target.value); socket.emit('typing', { user_name: username, room }); }}
                        placeholder="Type a message..."
                        onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    />
                    <button onClick={sendMessage} disabled={!message.trim()} className="bg-indigo-600 text-white p-2 rounded-xl disabled:bg-slate-300 disabled:shadow-none shadow-md shadow-indigo-200">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" /></svg>
                    </button>
                </div>
            </footer>
        </div>
    );
};

Chatroom.propTypes = { username: PropTypes.string.isRequired, room: PropTypes.string.isRequired };
export default Chatroom;