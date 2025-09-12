import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiSend, FiMessageCircle, FiTrendingUp, FiBookOpen, FiSearch } from 'react-icons/fi';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const suggestionPrompts = [
  {
    icon: <FiTrendingUp className="w-5 h-5" />,
    title: "Latest Trends",
    prompt: "What are the latest trends in machine learning and AI?"
  },
  {
    icon: <FiBookOpen className="w-5 h-5" />,
    title: "Research Topic",
    prompt: "Help me understand quantum computing research"
  },
  {
    icon: <FiSearch className="w-5 h-5" />,
    title: "Explore Field", 
    prompt: "What are the emerging areas in biotechnology?"
  }
];

export default function SimpleChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Add welcome message when component mounts
    const welcomeMessage: Message = {
      id: 'welcome',
      role: 'assistant',
      content: "👋 Hello! I'm your Research Assistant\n\nI'm here to help you with:\n• Research topics and explanations\n• Current trends in various fields\n• Academic insights and analysis\n• Topic exploration and deep dives\n\nWhat would you like to research today?",
      timestamp: new Date().toISOString()
    };
    setMessages([welcomeMessage]);
  }, []);

  const sendMessage = async (messageText?: string) => {
    const messageToSend = messageText || input.trim();
    if (!messageToSend || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageToSend,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    // Auto-resize textarea back to single line
    if (textareaRef.current) {
      textareaRef.current.style.height = '40px';
    }

    try {
      const response = await fetch('/api/chat/cerebras', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: messageToSend
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || data.message || 'Sorry, I received an empty response.',
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, assistantMessage]);
      
    } catch (error) {
      console.error('Error:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `❌ **Sorry, I encountered an error**\n\n${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again or rephrase your question.`,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    
    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = '40px';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  };

  const handleSuggestionClick = (prompt: string) => {
    setInput(prompt);
    sendMessage(prompt);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="max-w-4xl mx-auto h-screen flex flex-col">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/80 backdrop-blur-sm border-b border-gray-200 p-6 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FiMessageCircle className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Research Assistant</h1>
              <p className="text-gray-600">Your AI companion for research and learning</p>
            </div>
          </div>
        </motion.div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <AnimatePresence initial={false}>
            {messages.map((message, index) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-2xl ${message.role === 'user' ? 'order-2' : 'order-1'}`}>
                  <div
                    className={`px-6 py-4 rounded-2xl shadow-sm ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white ml-4'
                        : 'bg-white text-gray-800 mr-4 border border-gray-100'
                    }`}
                  >
                    <div className="prose prose-sm max-w-none">
                      {message.content.split('\n').map((line, i) => {
                        if (line.startsWith('• ') || line.startsWith('- ')) {
                          return (
                            <div key={i} className="flex items-start gap-2 my-1">
                              <span className="text-blue-500 mt-1">•</span>
                              <span>{line.substring(2)}</span>
                            </div>
                          );
                        }
                        if (line.startsWith('**') && line.endsWith('**')) {
                          return (
                            <div key={i} className="font-semibold my-2">
                              {line.replace(/\*\*/g, '')}
                            </div>
                          );
                        }
                        return line ? <div key={i} className="my-1">{line}</div> : <div key={i} className="h-2" />;
                      })}
                    </div>
                    <p className={`text-xs mt-3 ${
                      message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                    }`}>
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  message.role === 'user' 
                    ? 'bg-blue-600 text-white order-1' 
                    : 'bg-gray-100 text-gray-600 order-2'
                }`}>
                  {message.role === 'user' ? '👤' : '🤖'}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {/* Suggestions (show only when no user messages) */}
          {messages.length === 1 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8"
            >
              {suggestionPrompts.map((suggestion, index) => (
                <motion.button
                  key={index}
                  whileHover={{ scale: 1.02, translateY: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSuggestionClick(suggestion.prompt)}
                  className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 text-left group"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                      {suggestion.icon}
                    </div>
                    <h3 className="font-medium text-gray-900">{suggestion.title}</h3>
                  </div>
                  <p className="text-sm text-gray-600">{suggestion.prompt}</p>
                </motion.button>
              ))}
            </motion.div>
          )}
          
          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                  🤖
                </div>
                <div className="bg-white border border-gray-100 px-6 py-4 rounded-2xl shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                      <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    </div>
                    <span className="text-gray-600">Researching your question...</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/80 backdrop-blur-sm border-t border-gray-200 p-6"
        >
          <div className="flex gap-4 items-end">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                placeholder="Ask about research topics, trends, or any questions..."
                className="w-full border border-gray-300 rounded-xl px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent resize-none transition-all duration-200 shadow-sm"
                style={{ height: '40px', minHeight: '40px', maxHeight: '120px' }}
                disabled={loading}
              />
              <div className="absolute right-3 bottom-3 text-gray-400">
                <FiMessageCircle className="w-5 h-5" />
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <FiSend className="w-5 h-5" />
            </motion.button>
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            Press Enter to send • Shift+Enter for new line
          </p>
        </motion.div>
      </div>
    </div>
  );
}
