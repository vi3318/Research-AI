import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Copy, Check, Download, BookOpen, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

interface CitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  paperData: any;
}

interface CitationResponse {
  success: boolean;
  citations: {
    ieee: string;
    apa: string;
    mla: string;
  };
  warnings?: string[];
}

function CitationModal({ isOpen, onClose, paperData }: CitationModalProps): JSX.Element | null {
  const [citations, setCitations] = useState<CitationResponse['citations'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedStyle, setCopiedStyle] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [hasGenerated, setHasGenerated] = useState(false);

  // Safe citation renderer to handle objects with $ and _ properties
  const renderCitation = (citation: any): string => {
    if (typeof citation === 'string') {
      return citation;
    }
    
    if (typeof citation === 'object' && citation !== null) {
      // Handle objects with $ and _ properties (common in parsed XML/BibTeX)
      if (citation._ && typeof citation._ === 'string') {
        return citation._;
      }
      
      // Construct citation from object properties
      const parts: string[] = [];
      
      if (citation.authors || citation.author) {
        const authors = Array.isArray(citation.authors) 
          ? citation.authors.join(', ')
          : citation.authors || citation.author;
        parts.push(authors);
      }
      
      if (citation.title) {
        parts.push(`"${citation.title}"`);
      }
      
      if (citation.journal || citation.venue) {
        parts.push(citation.journal || citation.venue);
      }
      
      if (citation.year) {
        parts.push(`(${citation.year})`);
      }
      
      if (citation.doi) {
        parts.push(`DOI: ${citation.doi}`);
      }
      
      if (citation.link || citation.url) {
        parts.push(citation.link || citation.url);
      }
      
      return parts.length > 0 ? parts.join(', ') : 'Citation format not supported';
    }
    
    return 'Invalid citation format';
  };

  const citationStyles = useMemo(() => [
    { key: 'ieee', name: 'IEEE', description: 'Institute of Electrical and Electronics Engineers' },
    { key: 'apa', name: 'APA', description: 'American Psychological Association' },
    { key: 'mla', name: 'MLA', description: 'Modern Language Association' }
  ], []);

  // Memoize paper identifier to prevent unnecessary re-renders
  const paperIdentifier = useMemo(() => 
    paperData ? `${paperData.title}-${paperData.doi || paperData.paper_id || 'unknown'}` : null, 
    [paperData?.title, paperData?.doi, paperData?.paper_id]
  );

  const generateCitations = useCallback(async () => {
    if (loading || hasGenerated || !paperData) return; // Prevent multiple simultaneous requests
    
    console.log('Generating citations for:', paperData);
    setLoading(true);
    setError(null);
    setWarnings([]);

    const loadingToast = toast.loading('🔖 Generating citations...');

    try {
      // Use the new apiClient instead of fetch
      const { apiClient } = await import('../lib/apiClient');
      const response = await apiClient.generateCitations(paperData);
      
      console.log('Citation response:', response);

      if (response.success) {
        setCitations(response.citations);
        setHasGenerated(true);
        toast.dismiss(loadingToast);
        toast.success('✅ Citations generated successfully!');
        if (response.warnings?.length > 0) {
          setWarnings(response.warnings);
          toast('⚠️ Some citation warnings were found. Check the details below.', {
            icon: '⚠️',
            duration: 4000,
          });
        }
      } else {
        throw new Error(response.message || 'Failed to generate citations');
      }
    } catch (error: any) {
      console.error('Citation generation error:', error);
      toast.dismiss(loadingToast);
      
      // Provide specific error messages for common issues
      if (error.message.includes('429')) {
        toast.error('🚫 Too many requests. Please wait a moment before trying again.');
        setError('Rate limit exceeded. Please wait a moment before generating citations again.');
      } else if (error.message.includes('401')) {
        toast.error('🔒 Authentication required. Please log in again.');
        setError('Authentication failed. Please log in again to generate citations.');
      } else {
        toast.error('❌ Failed to generate citations. Please try again.');
        setError(error.message || 'An unexpected error occurred while generating citations');
      }
    } finally {
      setLoading(false);
    }
  }, [paperData, loading, hasGenerated]);

  useEffect(() => {
    if (isOpen && paperData && paperIdentifier && !hasGenerated && !loading && !citations) {
      // Add a delay to prevent rapid generation cycles
      const timer = setTimeout(() => {
        if (isOpen && !hasGenerated && !citations) { // Double-check conditions
          generateCitations();
        }
      }, 500); // Increased delay to prevent flickering
      
      return () => clearTimeout(timer);
    }
  }, [isOpen, paperIdentifier, hasGenerated, loading, citations, generateCitations]);

  // Reset state when modal closes with a small delay to prevent flicker
  useEffect(() => {
    if (!isOpen) {
      const timer = setTimeout(() => {
        setCitations(null);
        setHasGenerated(false);
        setError(null);
        setWarnings([]);
        setCopiedStyle(null);
      }, 200); // Small delay to prevent flicker on quick open/close
      
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Reset state when modal closes or paper changes
  useEffect(() => {
    if (!isOpen) {
      // Small delay to prevent flickering during modal transition
      const timeoutId = setTimeout(() => {
        setCitations(null);
        setError(null);
        setWarnings([]);
        setHasGenerated(false);
        setLoading(false);
      }, 200);
      
      return () => clearTimeout(timeoutId);
    }
  }, [isOpen]);

  // Reset state when paper changes
  useEffect(() => {
    if (paperIdentifier) {
      setCitations(null);
      setError(null);
      setWarnings([]);
      setHasGenerated(false);
      setLoading(false);
    }
  }, [paperIdentifier]);

  const copyToClipboard = useCallback(async (citation: any, style: string) => {
    if (copiedStyle === style) return; // Prevent multiple rapid clicks
    
    try {
      const text = renderCitation(citation);
      await navigator.clipboard.writeText(text);
      setCopiedStyle(style);
      toast.success(`📋 ${style.toUpperCase()} citation copied to clipboard!`);
      setTimeout(() => setCopiedStyle(null), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      toast.error('❌ Failed to copy to clipboard. Please try again.');
    }
  }, [copiedStyle]);

  const downloadCitation = useCallback((citation: any, style: string) => {
    try {
      const text = renderCitation(citation);
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `citation-${style}-${paperData?.title?.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '-') || 'paper'}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`💾 ${style.toUpperCase()} citation downloaded successfully!`);
    } catch (error) {
      console.error('Failed to download citation:', error);
      toast.error('❌ Failed to download citation. Please try again.');
    }
  }, [paperData?.title]);

  // Memoize the modal click handler to prevent unnecessary re-renders
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  const handleModalClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  if (!isOpen) return null;

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div 
          key="citation-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[9999] p-4"
          onClick={handleBackdropClick}
        >
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={handleModalClick}
          >
            {/* Header */}
            <div className="flex justify-between items-start p-6 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-start space-x-3 flex-1 pr-4">
                <BookOpen className="h-6 w-6 text-blue-600 mt-1 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-bold text-gray-900 mb-2">Cite This Paper</h2>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {paperData?.title?.substring(0, 150)}
                    {paperData?.title?.length > 150 ? '...' : ''}
                  </p>
                  {paperData?.authors && (
                    <p className="text-xs text-gray-500 mt-1">
                      {Array.isArray(paperData.authors) 
                        ? paperData.authors.slice(0, 3).join(', ') + (paperData.authors.length > 3 ? ' et al.' : '')
                        : paperData.authors
                      }
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Paper Data Missing Warning */}
              {!paperData && (
                <div className="text-center py-12">
                  <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Paper Data</h3>
                  <p className="text-gray-600 mb-4">Unable to generate citations without paper information.</p>
                  <button
                    onClick={onClose}
                    className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Close
                  </button>
                </div>
              )}

              {/* Warnings */}
              {paperData && warnings.length > 0 && (
                <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="font-medium text-yellow-800">Citation Warnings</h3>
                      <ul className="mt-2 text-sm text-yellow-700 space-y-1">
                        {warnings.map((warning, index) => (
                          <li key={index}>• {warning}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Loading State */}
              {paperData && loading && (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="relative">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    <div className="absolute inset-0 rounded-full h-12 w-12 border-2 border-gray-200"></div>
                  </div>
                  <h3 className="mt-4 text-lg font-medium text-gray-900">Generating Citations</h3>
                  <p className="mt-2 text-sm text-gray-600 text-center max-w-sm">
                    Creating IEEE, APA, and MLA citations for:<br />
                    <span className="font-medium">"{paperData.title?.substring(0, 60)}..."</span>
                  </p>
                  <div className="mt-4 flex space-x-2">
                    {citationStyles.map((style, index) => (
                      <div
                        key={style.key}
                        className={`px-3 py-1 rounded-full text-xs transition-colors duration-300 ${
                          index === 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {style.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Error State */}
              {paperData && error && !loading && (
                <div className="text-center py-12">
                  <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Citation Generation Failed</h3>
                  <p className="text-gray-600 mb-4">{error}</p>
                  <button
                    onClick={generateCitations}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {/* Citations Grid */}
              {paperData && citations && !loading && (
                <div className="grid grid-cols-1 gap-6">
                  {citationStyles.map((style) => {
                    const citation = citations[style.key as keyof typeof citations];
                    if (!citation) return null;

                    return (
                      <div
                        key={style.key}
                        className="bg-gray-50 rounded-lg p-5 border border-gray-200 hover:border-gray-300 transition-colors"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="font-semibold text-gray-900 text-lg">{style.name}</h3>
                            <p className="text-sm text-gray-500">{style.description}</p>
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => copyToClipboard(citation, style.key)}
                              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Copy to clipboard"
                            >
                              {copiedStyle === style.key ? (
                                <Check className="h-4 w-4 text-green-600" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </button>
                            <button
                              onClick={() => downloadCitation(citation, style.key)}
                              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Download citation"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        <div className="bg-white rounded border p-4">
                          <p className="text-sm text-gray-800 font-mono leading-relaxed">
                            {renderCitation(citation)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            {paperData && citations && !loading && (
              <div className="border-t border-gray-200 p-4 bg-gray-50 flex-shrink-0">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-600">
                    Generated {citationStyles.length} citation formats
                  </p>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        const allCitations = citationStyles
                          .map(style => {
                            const citation = citations[style.key as keyof typeof citations];
                            return citation ? `${style.name}:\n${citation}\n` : '';
                          })
                          .filter(Boolean)
                          .join('\n');
                        
                        const blob = new Blob([allCitations], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `all-citations-${paperData?.title?.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '-') || 'paper'}.txt`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    >
                      Download All
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default CitationModal;
