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
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
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
        <div className="flex flex-col h-[600px] w-full max-w-lg mx-auto bg-slate-50 border border-slate-200 rounded-3xl overflow-hidden shadow-2xl relative">
            
            {/* Header */}
            <div className="bg-white px-6 py-4 flex justify-between items-center border-b border-slate-100 shadow-sm z-10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                        {room[0].toUpperCase()}
                    </div>
                    <div>
                        <h2 className="font-bold text-slate-800 text-base leading-none capitalize">Room: {room}</h2>
                        <p className="text-[11px] text-green-500 font-medium mt-1">● Online</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-4">
                    {/* Call Button */}
                    {!isCalling ? (
                        <button onClick={startCall} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-full transition">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                            </svg>
                        </button>
                    ) : (
                        <button onClick={() => stopCall(true)} className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-full transition animate-pulse">
                             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 rotate-[135deg]">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                            </svg>
                        </button>
                    )}
                    <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Logged in as</span>
                    <span className="text-sm font-semibold text-indigo-600 capitalize">{username}</span>
                </div>
                </div>
            </div>

            {/* Incoming Call Notification */}
            {incomingCall && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[90%] bg-white p-4 shadow-2xl rounded-2xl border-2 border-indigo-500 z-50 animate-bounce">
                    <p className="text-sm font-bold text-center text-slate-700">{incomingCall.from} is calling you...</p>
                    <div className="flex justify-center gap-4 mt-3">
                        <button onClick={acceptCall} className="bg-green-500 text-white px-6 py-2 rounded-xl text-sm font-bold">Accept</button>
                        <button onClick={() => setIncomingCall(null)} className="bg-red-500 text-white px-6 py-2 rounded-xl text-sm font-bold">Reject</button>
                    </div>
                </div>
            )}

            <audio ref={remoteAudioRef} autoPlay />

            {/* Message Area */}
            <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-[#f8faff] custom-scrollbar">
                {messages.map((msg) => {
                    const isMe = msg.author === username;
                    return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
                            <div className={`flex flex-col max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                                {!isMe && <span className="text-[10px] font-bold text-slate-400 ml-2 mb-1 uppercase tracking-tighter">{msg.author}</span>}
                                <div className={`px-4 py-3 shadow-md ${isMe ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-none' : 'bg-white text-slate-700 rounded-2xl rounded-tl-none border border-slate-100'}`}>
                                    {msg.type === 'image' ? (
                                        <img src={msg.image} alt="sent" className="rounded-lg max-h-60 w-full object-cover" />
                                    ) : (
                                        <p className="px-2 py-1 text-sm">{msg.message}</p>
                                    )}
                                    <p className={`text-[9px] mt-1.5 flex items-center gap-1 ${isMe ? 'text-indigo-200' : 'text-slate-400'}`}>
                                        {msg.timestamp} {isMe && <span>✓✓</span>}
                                    </p>
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="bg-white border-t border-slate-100 p-4">
                <div className="h-5 mb-1 px-2">
                    {typingMessage && <span className="text-[11px] italic text-slate-400 animate-pulse">{typingMessage}</span>}
                </div>
                <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
                    <label className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-full cursor-pointer">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                        </svg>
                        <input type="file" accept="image/*" className="hidden" onChange={sendImage} />
                    </label>
                    <input
                        type="text"
                        className="flex-1 px-4 py-2.5 bg-transparent border-none focus:ring-0 text-sm"
                        value={message}
                        onChange={(e) => { setMessage(e.target.value); socket.emit('typing', { user_name: username, room }); }}
                        placeholder="Aa"
                        onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    />
                    <button onClick={sendMessage} disabled={!message.trim()} className="bg-indigo-600 text-white p-2.5 rounded-xl disabled:bg-slate-200">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                            <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

Chatroom.propTypes = { username: PropTypes.string.isRequired, room: PropTypes.string.isRequired };
export default Chatroom;