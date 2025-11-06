import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Brain, Sparkles, RefreshCw, Copy, Download } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface HumanizerProps {
  workspaceId: string;
}

const Humanizer: React.FC<HumanizerProps> = ({ workspaceId }) => {
  const [inputText, setInputText] = useState('');
  const [humanizedText, setHumanizedText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectionScore, setDetectionScore] = useState<number | null>(null);

  const handleHumanize = async () => {
    if (!inputText.trim()) {
      toast.error('Please enter some text to humanize');
      return;
    }

    setIsProcessing(true);
    const loadingToast = toast.loading('🤖 Humanizing your text...');

    try {
      console.log('🧠 Starting text humanization process...');
      
      // Get authentication token
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('Authentication required. Please log in.');
      }
      
      // Call Simple Humanizer API (direct Cerebras)
      const response = await fetch('/api/simple-humanizer/humanize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          text: inputText
        })
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication failed. Please log in again.');
        } else if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please wait a moment and try again.');
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      }

      const data = await response.json();
      
      console.log('✅ Text humanization completed:', {
        originalLength: inputText.length,
        humanizedLength: data.humanized_text?.length || 0,
        provider: data.provider,
        model: data.model,
        latency: data.latency_ms
      });

      setHumanizedText(data.humanized_text || '');
      setDetectionScore(null); // Simple humanizer doesn't provide detection score
      
      toast.dismiss(loadingToast);
      toast.success(`🎉 Humanized via ${data.provider} (${data.model}) in ${data.latency_ms}ms!`);

    } catch (error: any) {
      console.error('❌ Error humanizing text:', error);
      toast.dismiss(loadingToast);
      
      if (error.message?.includes('Authentication failed') || error.message?.includes('Authentication required')) {
        toast.error('🔐 Authentication required. Please log in again.');
      } else if (error.message?.includes('429') || error.message?.includes('Rate limit')) {
        toast.error('⏳ API rate limit reached. Please wait a moment and try again.');
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        toast.error('🌐 Network error. Please check your connection.');
      } else {
        toast.error(`❌ Failed to humanize text: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('📋 Text copied to clipboard!');
    } catch (error) {
      toast.error('Failed to copy text');
    }
  };

  const handleClear = () => {
    setInputText('');
    setHumanizedText('');
    setDetectionScore(null);
  };

  const getScoreColor = (score: number) => {
    if (score < 30) return 'text-green-600';
    if (score < 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreDescription = (score: number) => {
    if (score < 30) return 'Very Human-like';
    if (score < 50) return 'Mostly Human-like';
    if (score < 70) return 'Potentially AI-generated';
    return 'Likely AI-generated';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="flex items-center justify-center mb-4">
          <Brain className="w-8 h-8 mr-3 text-pink-600" />
          <h2 className="text-2xl font-bold text-gray-900">AI Text Humanizer</h2>
        </div>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Transform AI-generated text into more natural, human-like content using advanced language models.
          Perfect for academic writing, research papers, and professional documents.
        </p>
      </motion.div>

      {/* Input Section */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-lg shadow-lg p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Sparkles className="w-5 h-5 mr-2 text-blue-600" />
            Input Text
          </h3>
          <span className="text-sm text-gray-500">
            {inputText.length} characters
          </span>
        </div>
        
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Paste your AI-generated text here to make it more human-like..."
          className="w-full h-40 p-4 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          disabled={isProcessing}
        />
        
        <div className="flex justify-between items-center mt-4">
          <button
            onClick={handleClear}
            disabled={!inputText.trim() || isProcessing}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Clear
          </button>
          
          <button
            onClick={handleHumanize}
            disabled={!inputText.trim() || isProcessing}
            className="px-6 py-2 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-lg hover:from-pink-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {isProcessing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Brain className="w-4 h-4" />
            )}
            <span>{isProcessing ? 'Humanizing...' : 'Humanize Text'}</span>
          </button>
        </div>
      </motion.div>

      {/* Output Section */}
      {(humanizedText || isProcessing) && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-lg shadow-lg p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Brain className="w-5 h-5 mr-2 text-pink-600" />
              Humanized Text
            </h3>
            <div className="flex items-center space-x-2">
              {detectionScore !== null && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">AI Detection:</span>
                  <span className={`text-sm font-semibold ${getScoreColor(detectionScore)}`}>
                    {detectionScore.toFixed(1)}% - {getScoreDescription(detectionScore)}
                  </span>
                </div>
              )}
              <span className="text-sm text-gray-500">
                {humanizedText.length} characters
              </span>
            </div>
          </div>
          
          {isProcessing ? (
            <div className="flex items-center justify-center h-40 bg-gray-50 rounded-lg">
              <div className="text-center">
                <RefreshCw className="w-8 h-8 animate-spin text-pink-600 mx-auto mb-2" />
                <p className="text-gray-600">Processing your text...</p>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-gray-50 rounded-lg p-4 min-h-40 whitespace-pre-wrap font-mono text-sm">
                {humanizedText}
              </div>
              
              <div className="flex justify-end items-center mt-4 space-x-2">
                <button
                  onClick={() => handleCopy(humanizedText)}
                  className="px-4 py-2 text-pink-600 hover:text-pink-800 flex items-center space-x-1"
                >
                  <Copy className="w-4 h-4" />
                  <span>Copy</span>
                </button>
                
                <button
                  onClick={() => {
                    const blob = new Blob([humanizedText], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `humanized-text-${new Date().toISOString().split('T')[0]}.txt`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success('📥 Text downloaded!');
                  }}
                  className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 flex items-center space-x-1"
                >
                  <Download className="w-4 h-4" />
                  <span>Download</span>
                </button>
              </div>
            </>
          )}
        </motion.div>
      )}

      {/* Features Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-lg p-6"
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Features</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="flex items-start space-x-3">
            <Brain className="w-5 h-5 text-pink-600 mt-1" />
            <div>
              <h4 className="font-medium text-gray-900">Advanced AI Models</h4>
              <p className="text-sm text-gray-600">Uses state-of-the-art HuggingFace models for text transformation</p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3">
            <Sparkles className="w-5 h-5 text-purple-600 mt-1" />
            <div>
              <h4 className="font-medium text-gray-900">Natural Language</h4>
              <p className="text-sm text-gray-600">Converts robotic AI text into natural, flowing prose</p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3">
            <RefreshCw className="w-5 h-5 text-blue-600 mt-1" />
            <div>
              <h4 className="font-medium text-gray-900">Detection Bypass</h4>
              <p className="text-sm text-gray-600">Reduces AI detection scores while maintaining meaning</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Humanizer;
