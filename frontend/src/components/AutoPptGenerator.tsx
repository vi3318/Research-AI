import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  HiUpload, HiDownload, HiDocumentText, HiSparkles, HiCog 
} from 'react-icons/hi';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { apiClient } from '../lib/apiClient';

interface AutoPptTheme {
  id: string;
  name: string;
  description: string;
}

interface GeneratedPresentation {
  title: string;
  totalSlides: number;
  theme: string;
  downloadUrl: string;
  downloadSize: number;
  slides: Array<{
    type: string;
    title: string;
    content: string;
  }>;
}

export default function AutoPptGenerator() {
  const { theme } = useTheme();
  const { session } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [selectedTheme, setSelectedTheme] = useState('minimal');
  const [customTitle, setCustomTitle] = useState('');
  const [customAuthor, setCustomAuthor] = useState('');
  const [availableThemes, setAvailableThemes] = useState<AutoPptTheme[]>([]);
  const [generatedPresentation, setGeneratedPresentation] = useState<GeneratedPresentation | null>(null);

  // Load available themes on component mount
  React.useEffect(() => {
    loadThemes();
  }, []);

  const loadThemes = async () => {
    try {
      // Use simple endpoint that doesn't require auth
      const response = await fetch('/api/simple-auto-ppt/themes');
      const data = await response.json();
      setAvailableThemes(data.themes || []);
    } catch (error) {
      console.error('Failed to load themes:', error);
      // Set default themes if API fails
      setAvailableThemes([
        { id: 'minimal', name: 'Minimal', description: 'Clean and simple design with blue accents' },
        { id: 'academic', name: 'Academic', description: 'Professional academic style with serif fonts' },
        { id: 'corporate', name: 'Corporate', description: 'Modern business style with clean layouts' },
        { id: 'modern', name: 'Modern Dark', description: 'Sleek dark theme with bright accents' },
        { id: 'vibrant', name: 'Vibrant', description: 'Colorful design with purple and gold' }
      ]);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast.error('Please upload a PDF file');
        return;
      }
      if (file.size > 50 * 1024 * 1024) {
        toast.error('File size must be less than 50MB');
        return;
      }
      setUploadedFile(file);
      toast.success('PDF uploaded successfully');
    }
  };

  const generatePresentation = async () => {
    if (!uploadedFile) {
      toast.error('Please upload a PDF file first');
      return;
    }

    setIsGenerating(true);
    const loadingToast = toast.loading('🤖 Generating your presentation...');

    try {
      const formData = new FormData();
      formData.append('pdf', uploadedFile);
      formData.append('theme', selectedTheme);
      if (customTitle) formData.append('title', customTitle);
      if (customAuthor) formData.append('author', customAuthor);

      // Use simple endpoint that doesn't require auth
      const response = await fetch('/api/simple-auto-ppt/generate-from-pdf', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      setGeneratedPresentation({
        ...data.presentation,
        downloadSize: data.downloadSize,
        downloadUrl: data.downloadUrl
      });
      
      toast.dismiss(loadingToast);
      toast.success('🎉 Presentation generated successfully!');

    } catch (error: any) {
      toast.dismiss(loadingToast);
      console.error('Error generating presentation:', error);
      toast.error(error.message || 'Failed to generate presentation');
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadPresentation = async () => {
    if (!generatedPresentation?.downloadUrl) {
      toast.error('Download URL not available');
      return;
    }

    try {
      const downloadId = generatedPresentation.downloadUrl.split('/').pop();
      
      if (!downloadId) {
        throw new Error('Invalid download URL');
      }
      
      // Use simple endpoint that doesn't require auth
      const response = await fetch(`/api/simple-auto-ppt/download/${downloadId}`, {
        method: 'GET',
        headers: { 'Accept': 'application/octet-stream' }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Get the response as blob
      const blob = await response.blob();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${generatedPresentation.title.replace(/[^a-zA-Z0-9]/g, '_')}.pptx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success('📥 Presentation downloaded!');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download presentation');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="flex items-center justify-center mb-4">
          <HiSparkles className="w-8 h-8 mr-3" style={{ color: theme.colors.primary }} />
          <h1 className="text-3xl font-bold" style={{ color: theme.colors.textPrimaryPrimary }}>
            Auto-PPT Generator
          </h1>
        </div>
        <p className="text-lg" style={{ color: theme.colors.textPrimarySecondary }}>
          Transform your research papers into professional presentations with AI
        </p>
      </motion.div>

      {/* Upload Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="p-6 rounded-2xl border-2 border-dashed"
        style={{ 
          backgroundColor: theme.colors.surface,
          borderColor: uploadedFile ? theme.colors.primary : theme.colors.border
        }}
      >
        <div className="text-center">
          <HiUpload className="w-16 h-16 mx-auto mb-4" style={{ color: theme.colors.primary }} />
          <h3 className="text-xl font-semibold mb-2" style={{ color: theme.colors.textPrimary }}>
            Upload Research Paper
          </h3>
          <p className="mb-6" style={{ color: theme.colors.textPrimarySecondary }}>
            Upload a PDF of your research paper to generate a presentation
          </p>
          
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            className="hidden"
            id="pdf-upload"
          />
          
          <label
            htmlFor="pdf-upload"
            className="inline-flex items-center px-6 py-3 rounded-xl font-medium cursor-pointer transition-all duration-200 hover:scale-105"
            style={{ 
              backgroundColor: theme.colors.primary,
              color: '#FFFFFF'
            }}
            >
              <HiDocumentText className="w-5 h-5 mr-2" />
              Choose PDF File
            </label>          {uploadedFile && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-4 p-4 rounded-xl"
              style={{ backgroundColor: theme.colors.background }}
            >
              <p className="font-medium" style={{ color: theme.colors.textPrimary }}>
                📄 {uploadedFile.name}
              </p>
              <p className="text-sm" style={{ color: theme.colors.textPrimarySecondary }}>
                {(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Configuration Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="p-6 rounded-2xl"
        style={{ backgroundColor: theme.colors.surface }}
      >
        <div className="flex items-center mb-6">
          <HiCog className="w-6 h-6 mr-3" style={{ color: theme.colors.primary }} />
          <h3 className="text-xl font-semibold" style={{ color: theme.colors.textPrimary }}>
            Presentation Settings
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Theme Selection */}
          <div>
            <label className="block text-sm font-medium mb-3" style={{ color: theme.colors.textPrimary }}>
              Theme
            </label>
            <div className="space-y-2">
              {availableThemes.map((themeOption) => (
                <label
                  key={themeOption.id}
                  className="flex items-center p-3 rounded-xl cursor-pointer transition-all duration-200"
                  style={{ 
                    backgroundColor: selectedTheme === themeOption.id 
                      ? `${theme.colors.primary}20` 
                      : theme.colors.background,
                    border: selectedTheme === themeOption.id 
                      ? `2px solid ${theme.colors.primary}` 
                      : `1px solid ${theme.colors.border}`
                  }}
                >
                  <input
                    type="radio"
                    name="theme"
                    value={themeOption.id}
                    checked={selectedTheme === themeOption.id}
                    onChange={(e) => setSelectedTheme(e.target.value)}
                    className="mr-3"
                  />
                  <div>
                    <p className="font-medium" style={{ color: theme.colors.textPrimary }}>
                      {themeOption.name}
                    </p>
                    <p className="text-sm" style={{ color: theme.colors.textPrimarySecondary }}>
                      {themeOption.description}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Custom Fields */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.textPrimary }}>
                Custom Title (Optional)
              </label>
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="Override auto-detected title"
                className="w-full px-4 py-3 rounded-xl border transition-all duration-200 focus:outline-none focus:ring-2"
                style={{ 
                  backgroundColor: theme.colors.background,
                  borderColor: theme.colors.border,
                  color: theme.colors.textPrimary,
                  '--tw-ring-color': theme.colors.primary
                } as any}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.textPrimary }}>
                Author Name (Optional)
              </label>
              <input
                type="text"
                value={customAuthor}
                onChange={(e) => setCustomAuthor(e.target.value)}
                placeholder="Your name or organization"
                className="w-full px-4 py-3 rounded-xl border transition-all duration-200 focus:outline-none focus:ring-2"
                style={{ 
                  backgroundColor: theme.colors.background,
                  borderColor: theme.colors.border,
                  color: theme.colors.textPrimary,
                  '--tw-ring-color': theme.colors.primary
                } as any}
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Generate Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-center"
      >
        <button
          onClick={generatePresentation}
          disabled={!uploadedFile || isGenerating}
          className="px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ 
            backgroundColor: theme.colors.primary,
            color: '#FFFFFF'
          }}
        >
          {isGenerating ? (
            <>
              <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
              Generating Presentation...
            </>
          ) : (
            <>
              <HiSparkles className="w-5 h-5 mr-2 inline" />
              Generate Presentation
            </>
          )}
        </button>
      </motion.div>

      {/* Generated Presentation Preview */}
      {generatedPresentation && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 rounded-2xl"
          style={{ backgroundColor: theme.colors.surface }}
        >
          <h3 className="text-xl font-semibold mb-4" style={{ color: theme.colors.textPrimary }}>
            📊 Generated Presentation
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <h4 className="font-medium mb-2" style={{ color: theme.colors.textPrimary }}>
                {generatedPresentation.title}
              </h4>
              <p style={{ color: theme.colors.textPrimarySecondary }}>
                {generatedPresentation.totalSlides} slides • {selectedTheme} theme
              </p>
              <p className="text-sm mt-1" style={{ color: theme.colors.textPrimarySecondary }}>
                Size: {generatedPresentation.downloadSize ? 
                  (generatedPresentation.downloadSize / (1024 * 1024)).toFixed(2) : 'Unknown'} MB
              </p>
            </div>
            
            <div className="flex justify-end">
              <button
                onClick={downloadPresentation}
                className="flex items-center px-6 py-3 rounded-xl font-medium transition-all duration-200 hover:scale-105"
                style={{ 
                  backgroundColor: theme.colors.primary,
                  color: '#FFFFFF'
                }}
              >
                <HiDownload className="w-5 h-5 mr-2" />
                Download PPTX
              </button>
            </div>
          </div>

          {/* Slide Preview */}
          <div>
            <h5 className="font-medium mb-3" style={{ color: theme.colors.textPrimary }}>
              Slide Overview
            </h5>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {generatedPresentation.slides.map((slide, index) => (
                <div
                  key={index}
                  className="p-4 rounded-xl border"
                  style={{ 
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.border
                  }}
                >
                  <div className="flex items-center mb-2">
                    <span 
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mr-2"
                      style={{ 
                        backgroundColor: theme.colors.primary,
                        color: '#FFFFFF'
                      }}
                    >
                      {index + 1}
                    </span>
                    <h6 className="font-medium text-sm" style={{ color: theme.colors.textPrimary }}>
                      {slide.title}
                    </h6>
                  </div>
                  <p className="text-xs" style={{ color: theme.colors.textPrimarySecondary }}>
                    {slide.type} • {slide.content.length > 50 ? slide.content.substring(0, 50) + '...' : slide.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
