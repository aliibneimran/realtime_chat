import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import PropTypes from 'prop-types';

const socket = io.connect('http://localhost:3000');

const Chatroom = ({ username, room }) => {
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([]);
    const [typingMessage, setTypingMessage] = useState('');
    const messagesEndRef = useRef(null);

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
        return () => {
            socket.off('receive_message');
            socket.off('user_typing');
        };
    }, [room, username]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, typingMessage]);

    const sendMessage = () => {
        if (message.trim()) {
            const messageData = {
                room: room,
                author: username,
                message: message,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                id: Math.random().toString(36).substr(2, 9)
            };
            socket.emit('send_message', messageData);
            setMessages((prev) => [...prev, messageData]);
            setMessage('');
        }
    };
    // ইমেজ সিলেক্ট এবং পাঠানোর ফাংশন
    const sendImage = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                const messageData = {
                    room: room,
                    author: username,
                    image: reader.result, // Base64 Data
                    type: 'image',
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    id: Math.random().toString(36).substr(2, 9)
                };
                socket.emit('send_message', messageData);
                setMessages((prev) => [...prev, messageData]);
            };
            reader.readAsDataURL(file);
        }
    };
    const handleTyping = () => {
        socket.emit('typing', { user_name: username, room: room });
    };

    return (
        <div className="flex flex-col h-[600px] w-full max-w-lg mx-auto bg-slate-50 border border-slate-200 rounded-3xl overflow-hidden shadow-2xl">

            {/* Header: Clean & Modern */}
            <div className="bg-white px-6 py-4 flex justify-between items-center border-b border-slate-100 shadow-sm z-10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                        {room[0].toUpperCase()}
                    </div>
                    <div>
                        <h2 className="font-bold text-slate-800 text-base leading-none capitalize">Room:{room}</h2>
                        <p className="text-[11px] text-green-500 font-medium mt-1">● Online</p>
                    </div>
                </div>
                <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Logged in as</span>
                    <span className="text-sm font-semibold text-indigo-600 capitalize">{username}</span>
                </div>
            </div>

            {/* Message Area: Subtle Background Pattern */}
            <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-[#f8faff] custom-scrollbar">
                {messages.map((msg) => {
                    const isMe = msg.author === username;
                    return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
                            <div className={`flex flex-col max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                                {!isMe && <span className="text-[10px] font-bold text-slate-400 ml-2 mb-1 uppercase tracking-tighter">{msg.author}</span>}

                                <div className={`px-4 py-3 shadow-md ${isMe
                                    ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-none'
                                    : 'bg-white text-slate-700 rounded-2xl rounded-tl-none border border-slate-100'
                                    }`}>
                                    {msg.type === 'image' ? (
                                        <img src={msg.image} alt="sent" className="rounded-lg max-h-60 w-full object-cover cursor-pointer hover:opacity-90 transition" />
                                    ) : (
                                        <p className="px-2 py-1 text-sm">{msg.message}</p>
                                    )}
                                    <p className={`text-[9px] mt-1.5 flex items-center gap-1 ${isMe ? 'text-indigo-200' : 'text-slate-400'}`}>
                                        {msg.timestamp}
                                        {isMe && <span>✓✓</span>}
                                    </p>
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Typing Indicator & Input */}
            <div className="bg-white border-t border-slate-100 p-4">
                <div className="h-5 mb-1 px-2">
                    {typingMessage && (
                        <span className="text-[11px] italic text-slate-400 flex items-center gap-1 animate-pulse">
                            <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce"></span>
                            {typingMessage}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-2xl border border-slate-200 focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-50 transition-all duration-300">
                    <label className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-full cursor-pointer transition">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                        </svg>
                        <input type="file" accept="image/*" className="hidden" onChange={sendImage} />
                    </label>
                    <input
                        type="text"
                        className="flex-1 px-4 py-2.5 bg-transparent border-none focus:ring-0 text-sm text-slate-700 placeholder-slate-400"
                        value={message}
                        onChange={(e) => {
                            setMessage(e.target.value);
                            handleTyping();
                        }}
                        placeholder="Aa"
                        onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    />
                    <button
                        onClick={sendMessage}
                        disabled={!message.trim()}
                        className={`p-2.5 rounded-xl transition-all duration-300 ${message.trim()
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:scale-105 active:scale-95'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                            <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

Chatroom.propTypes = {
    username: PropTypes.string.isRequired,
    room: PropTypes.string.isRequired,
};

export default Chatroom;