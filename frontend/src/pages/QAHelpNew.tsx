import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send,
  BookOpen,
  Lightbulb,
  MessageSquare,
  Bot,
  User,
  Loader2
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { apiClient } from '../lib/apiClient';
import ReactMarkdown from 'react-markdown';
import toast from 'react-hot-toast';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const QAHelp: React.FC = () => {
  const { theme } = useTheme();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `Hello! I'm your **Research Assistant AI** powered by Gemini. I'm here to help you with:

📚 **Research Topic Guidance** - Get suggestions for research topics and directions
🎯 **Paper Writing Help** - Assistance with structuring and developing your research papers  
💡 **Methodology Advice** - Help choosing the right research methods and approaches
📊 **Literature Review Support** - Understanding current research trends and gaps
🔬 **Research Question Development** - Crafting focused and impactful research questions

What would you like to explore today? Feel free to ask me anything about your research!`,
      timestamp: new Date()
    }
  ]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: newMessage.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentMessage = newMessage.trim();
    setNewMessage('');
    setLoading(true);

    try {
      // Call the research assistant API
      const response = await apiClient.post('/research/qa-assistant', {
        question: currentMessage,
        context: 'research_guidance'
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.answer || 'I apologize, but I encountered an issue processing your question. Please try again.',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error getting response:', error);
      toast.error('Failed to get response. Please try again.');
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I apologize, but I\'m having trouble connecting right now. Please try again in a moment.',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const suggestedQuestions = [
    "What are some trending research topics in AI?",
    "How do I structure a literature review?",
    "What methodology should I use for my research?",
    "How do I develop a strong research question?",
    "What are the key components of a research paper?",
    "How do I identify research gaps in my field?"
  ];

  return (
    <div 
      className="h-screen flex flex-col"
      style={{ backgroundColor: theme.colors.background }}
    >
      {/* Header */}
      <div 
        className="flex-shrink-0 px-6 py-4 border-b"
        style={{ borderColor: theme.colors.border }}
      >
        <div className="flex items-center space-x-3">
          <div 
            className="p-2 rounded-lg"
            style={{ backgroundColor: theme.colors.primary + '20' }}
          >
            <Bot className="h-6 w-6" style={{ color: theme.colors.primary }} />
          </div>
          <div>
            <h1 
              className="text-2xl font-bold"
              style={{ color: theme.colors.textPrimary }}
            >
              Research Assistant AI
            </h1>
            <p 
              className="text-sm"
              style={{ color: theme.colors.textSecondary }}
            >
              Get guidance on research topics, methodology, and paper writing
            </p>
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        <AnimatePresence initial={false}>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-3xl px-4 py-3 rounded-2xl ${
                  message.role === 'user'
                    ? 'rounded-br-md'
                    : 'rounded-bl-md'
                }`}
                style={{
                  backgroundColor: message.role === 'user' 
                    ? theme.colors.primary
                    : theme.colors.surface,
                  color: message.role === 'user' 
                    ? 'white'
                    : theme.colors.textPrimary
                }}
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-1">
                    {message.role === 'user' ? (
                      <User className="h-5 w-5" />
                    ) : (
                      <Bot className="h-5 w-5" style={{ color: theme.colors.primary }} />
                    )}
                  </div>
                  <div className="flex-1">
                    {message.role === 'assistant' ? (
                      <ReactMarkdown 
                        className="prose prose-sm max-w-none"
                        components={{
                          p: ({ children }) => (
                            <p className="mb-2 last:mb-0" style={{ color: theme.colors.textPrimary }}>
                              {children}
                            </p>
                          ),
                          strong: ({ children }) => (
                            <strong style={{ color: theme.colors.primary }}>
                              {children}
                            </strong>
                          ),
                          ul: ({ children }) => (
                            <ul className="list-disc list-inside space-y-1 mb-2">
                              {children}
                            </ul>
                          ),
                          li: ({ children }) => (
                            <li style={{ color: theme.colors.textPrimary }}>
                              {children}
                            </li>
                          )
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    ) : (
                      <p>{message.content}</p>
                    )}
                    <p 
                      className="text-xs mt-2 opacity-70"
                      style={{ 
                        color: message.role === 'user' ? 'rgba(255,255,255,0.7)' : theme.colors.textSecondary 
                      }}
                    >
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {loading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div
              className="max-w-3xl px-4 py-3 rounded-2xl rounded-bl-md flex items-center space-x-3"
              style={{
                backgroundColor: theme.colors.surface,
                color: theme.colors.textPrimary
              }}
            >
              <Bot className="h-5 w-5" style={{ color: theme.colors.primary }} />
              <Loader2 className="h-4 w-4 animate-spin" style={{ color: theme.colors.primary }} />
              <span>Thinking...</span>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Questions */}
      {messages.length <= 1 && (
        <div className="px-6 py-2">
          <p 
            className="text-sm font-medium mb-3"
            style={{ color: theme.colors.textSecondary }}
          >
            Try asking:
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestedQuestions.map((question, index) => (
              <motion.button
                key={index}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setNewMessage(question)}
                className="px-3 py-2 text-sm rounded-lg border transition-colors"
                style={{
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  color: theme.colors.textSecondary
                }}
              >
                {question}
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div 
        className="flex-shrink-0 px-6 py-4 border-t"
        style={{ borderColor: theme.colors.border }}
      >
        <div className="flex space-x-3">
          <div className="flex-1">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me about research topics, methodology, paper writing..."
              className="w-full px-4 py-3 rounded-xl border resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                color: theme.colors.textPrimary
              }}
              rows={2}
              disabled={loading}
            />
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || loading}
            className="px-4 py-3 rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: theme.colors.primary,
              color: 'white'
            }}
          >
            <Send className="h-5 w-5" />
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default QAHelp;
