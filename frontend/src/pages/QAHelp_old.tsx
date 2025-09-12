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
    },
    {
      id: 'workspace-create',
      question: 'How do I create and manage workspaces?',
      answer: 'Go to the Workspace section and click "Create New Workspace". Workspaces allow you to collaborate with others, organize your research, and manage documents. Make sure you\'re signed in to create workspaces.',
      category: 'workspace',
      icon: Users
    },
    {
      id: 'presentation-mode',
      question: 'How do I create presentations from my research?',
      answer: 'Use the Presentation tab to automatically generate PowerPoint presentations from your research findings. The AI will create slides based on your papers and analysis.',
      category: 'features',
      icon: Beaker
    },
    {
      id: 'search-tips',
      question: 'How can I improve my search results?',
      answer: 'Be specific with your queries. Use academic terms and keywords. The system works best with queries like "deep learning computer vision", "BERT natural language processing", or "quantum computing algorithms". You can also ask specific questions about methodologies or applications.',
      category: 'search',
      icon: Lightbulb
    },
    {
      id: 'gap-analysis',
      question: 'What is research gap analysis?',
      answer: 'Research gap analysis identifies areas where current research is lacking or incomplete. In the Research Assistant, after finding papers, you can generate gap analysis to discover potential research opportunities and unexplored areas in your field.',
      category: 'features',
      icon: Beaker
    },
    {
      id: 'semantic-search',
      question: 'What is semantic search and how is it different?',
      answer: 'Semantic search understands the meaning and context of your query, not just keywords. It can find papers that discuss similar concepts even if they don\'t use the exact words you searched for. This is especially useful for finding related work and alternative approaches.',
      category: 'search',
      icon: BookOpen
    }
  ];

  const categories = [
    { id: 'all', label: 'All Topics', count: faqData.length },
    { id: 'search', label: 'Search & Discovery', count: faqData.filter(item => item.category === 'search').length },
    { id: 'features', label: 'Features & Tools', count: faqData.filter(item => item.category === 'features').length },
    { id: 'citations', label: 'Citations', count: faqData.filter(item => item.category === 'citations').length },
    { id: 'workspace', label: 'Workspaces', count: faqData.filter(item => item.category === 'workspace').length }
  ];

  const filteredFAQ = selectedCategory === 'all' 
    ? faqData 
    : faqData.filter(item => item.category === selectedCategory);

  const toggleExpanded = (id: string) => {
    setExpandedItem(expandedItem === id ? null : id);
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.colors.background }}>
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <HelpCircle className="h-10 w-10" style={{ color: theme.colors.primary }} />
            <h1 className="text-4xl font-bold" style={{ color: theme.colors.textPrimary }}>
              Help & FAQ
            </h1>
          </div>
          <p className="text-lg" style={{ color: theme.colors.textSecondary }}>
            Find answers to common questions about using ResearchAI
          </p>
        </motion.div>

        {/* Category Filter */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <div className="flex flex-wrap gap-3 justify-center">
            {categories.map(category => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  selectedCategory === category.id 
                    ? 'shadow-lg transform scale-105' 
                    : 'hover:shadow-md'
                }`}
                style={{
                  backgroundColor: selectedCategory === category.id 
                    ? theme.colors.primary 
                    : theme.colors.surface,
                  color: selectedCategory === category.id 
                    ? '#ffffff' 
                    : theme.colors.textPrimary,
                  border: `1px solid ${theme.colors.border}`
                }}
              >
                {category.label}
                <span className="ml-2 text-sm opacity-75">({category.count})</span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* FAQ Items */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          {filteredFAQ.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="rounded-xl shadow-sm overflow-hidden"
              style={{ 
                backgroundColor: theme.colors.surface,
                border: `1px solid ${theme.colors.border}`
              }}
            >
              <button
                onClick={() => toggleExpanded(item.id)}
                className="w-full px-6 py-4 flex items-center justify-between text-left hover:opacity-80 transition-opacity"
              >
                <div className="flex items-center gap-3">
                  <item.icon className="h-6 w-6 flex-shrink-0" style={{ color: theme.colors.primary }} />
                  <h3 className="text-lg font-semibold" style={{ color: theme.colors.textPrimary }}>
                    {item.question}
                  </h3>
                </div>
                <motion.div
                  animate={{ rotate: expandedItem === item.id ? 90 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronRight className="h-5 w-5" style={{ color: theme.colors.textSecondary }} />
                </motion.div>
              </button>
              
              <AnimatePresence>
                {expandedItem === item.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-4">
                      <div className="pl-9">
                        <p className="text-base leading-relaxed" style={{ color: theme.colors.textSecondary }}>
                          {item.answer}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </motion.div>

        {/* Quick Tips Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-16 p-8 rounded-xl"
          style={{ 
            backgroundColor: theme.colors.surface,
            border: `1px solid ${theme.colors.border}`
          }}
        >
          <div className="flex items-center gap-3 mb-6">
            <Lightbulb className="h-8 w-8" style={{ color: theme.colors.warning }} />
            <h2 className="text-2xl font-bold" style={{ color: theme.colors.textPrimary }}>
              Quick Tips
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-2" style={{ color: theme.colors.textPrimary }}>
                🔍 Better Search Results
              </h3>
              <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                Use specific academic terms, combine multiple keywords, and try different phrasings to get the most relevant papers.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2" style={{ color: theme.colors.textPrimary }}>
                📚 Citation Management
              </h3>
              <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                Always verify citation details before use. The AI generates citations from available metadata, but manual verification is recommended.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2" style={{ color: theme.colors.textPrimary }}>
                🤝 Collaboration
              </h3>
              <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                Use workspaces to share research with team members. You can invite collaborators and manage permissions.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2" style={{ color: theme.colors.textPrimary }}>
                🎯 Research Focus
              </h3>
              <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                Take advantage of gap analysis and hypothesis generation to identify new research directions and opportunities.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default QAHelp;
