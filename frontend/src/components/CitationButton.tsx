import React, { useState } from 'react';
import { Quote } from 'lucide-react';
import toast from 'react-hot-toast';

interface CitationButtonProps {
  paperData: any;
  variant?: 'primary' | 'secondary' | 'minimal';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const CitationButton: React.FC<CitationButtonProps> = ({
  paperData,
  variant = 'secondary',
  size = 'md',
  className = ''
}) => {
  const [generating, setGenerating] = useState(false);

  const handleClick = async () => {
    if (generating) return;
    
    setGenerating(true);
    const loadingToast = toast.loading('🔖 Generating citations...');

    try {
      // Import apiClient dynamically
      const { apiClient } = await import('../lib/apiClient');
      const response = await apiClient.generateCitations(paperData);
      
      toast.dismiss(loadingToast);

      if (response.success) {
        // Create HTML content for new window
        const citationHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Citations - ${paperData.title?.substring(0, 50) || 'Paper'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 2rem;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 2rem;
    }
    .header h1 {
      font-size: 1.75rem;
      font-weight: 700;
      margin-bottom: 0.75rem;
    }
    .header p {
      opacity: 0.95;
      font-size: 0.95rem;
      line-height: 1.5;
    }
    .content {
      padding: 2rem;
    }
    .citation-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      transition: all 0.3s;
    }
    .citation-card:hover {
      border-color: #667eea;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
    }
    .citation-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }
    .citation-title {
      font-size: 1.25rem;
      font-weight: 600;
      color: #1e293b;
    }
    .citation-subtitle {
      font-size: 0.875rem;
      color: #64748b;
      margin-top: 0.25rem;
    }
    .citation-actions {
      display: flex;
      gap: 0.5rem;
    }
    .btn {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
    }
    .btn-copy {
      background: #667eea;
      color: white;
    }
    .btn-copy:hover {
      background: #5568d3;
      transform: translateY(-2px);
    }
    .btn-download {
      background: white;
      color: #667eea;
      border: 1px solid #667eea;
    }
    .btn-download:hover {
      background: #f8fafc;
      transform: translateY(-2px);
    }
    .citation-text {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 1.25rem;
      font-family: 'Monaco', 'Courier New', monospace;
      font-size: 0.9rem;
      line-height: 1.6;
      color: #334155;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    .footer {
      text-align: center;
      padding: 1.5rem;
      border-top: 1px solid #e2e8f0;
      color: #64748b;
      font-size: 0.875rem;
    }
    .btn-download-all {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 0.75rem 1.5rem;
      font-size: 1rem;
    }
    .btn-download-all:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
    }
    @media print {
      body { background: white; padding: 0; }
      .container { box-shadow: none; }
      .btn { display: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📚 Citation Formats</h1>
      <p>${paperData.title || 'Research Paper'}</p>
      ${paperData.authors ? `<p style="margin-top: 0.5rem; opacity: 0.9; font-size: 0.85rem;">${Array.isArray(paperData.authors) ? paperData.authors.slice(0, 3).join(', ') + (paperData.authors.length > 3 ? ' et al.' : '') : paperData.authors}</p>` : ''}
    </div>
    
    <div class="content">
      ${['ieee', 'apa', 'mla'].map(style => {
        const citation = response.citations[style];
        const styleNames = {
          ieee: { name: 'IEEE', desc: 'Institute of Electrical and Electronics Engineers' },
          apa: { name: 'APA', desc: 'American Psychological Association (7th Edition)' },
          mla: { name: 'MLA', desc: 'Modern Language Association (9th Edition)' }
        };
        return `
          <div class="citation-card">
            <div class="citation-header">
              <div>
                <div class="citation-title">${styleNames[style].name}</div>
                <div class="citation-subtitle">${styleNames[style].desc}</div>
              </div>
              <div class="citation-actions">
                <button class="btn btn-copy" onclick="copyToClipboard('${style}', this)">
                  📋 Copy
                </button>
                <button class="btn btn-download" onclick="downloadCitation('${style}')">
                  💾 Download
                </button>
              </div>
            </div>
            <div class="citation-text" id="${style}-citation">${citation || 'Citation not available'}</div>
          </div>
        `;
      }).join('')}
    </div>
    
    <div class="footer">
      <button class="btn btn-download-all" onclick="downloadAll()">
        💾 Download All Citations
      </button>
      <p style="margin-top: 1rem;">Generated on ${new Date().toLocaleDateString()}</p>
    </div>
  </div>

  <script>
    function copyToClipboard(style, button) {
      const text = document.getElementById(style + '-citation').textContent;
      navigator.clipboard.writeText(text).then(() => {
        const originalText = button.innerHTML;
        button.innerHTML = '✅ Copied!';
        button.style.background = '#10b981';
        setTimeout(() => {
          button.innerHTML = originalText;
          button.style.background = '#667eea';
        }, 2000);
      });
    }

    function downloadCitation(style) {
      const text = document.getElementById(style + '-citation').textContent;
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'citation-' + style + '-${(paperData.title?.substring(0, 30) || 'paper').replace(/[^a-zA-Z0-9]/g, '-')}.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    function downloadAll() {
      const citations = ['ieee', 'apa', 'mla'].map(style => {
        const text = document.getElementById(style + '-citation').textContent;
        return style.toUpperCase() + ':\\n' + text + '\\n';
      }).join('\\n');
      
      const blob = new Blob([citations], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'all-citations-${(paperData.title?.substring(0, 30) || 'paper').replace(/[^a-zA-Z0-9]/g, '-')}.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  </script>
</body>
</html>
        `;

        // Open in new window
        const newWindow = window.open('', '_blank', 'width=1000,height=800,scrollbars=yes,resizable=yes');
        if (newWindow) {
          newWindow.document.write(citationHTML);
          newWindow.document.close();
          toast.success('✅ Citations opened in new window!');
        } else {
          toast.error('Please allow pop-ups to view citations');
        }
      } else {
        throw new Error(response.message || 'Failed to generate citations');
      }
    } catch (error: any) {
      toast.dismiss(loadingToast);
      console.error('[CitationButton] Error:', error);
      
      if (error.message.includes('429')) {
        toast.error('🚫 Too many requests. Please wait a moment.');
      } else if (error.message.includes('401')) {
        toast.error('🔒 Please log in to generate citations.');
      } else {
        toast.error('❌ Failed to generate citations. Please try again.');
      }
    } finally {
      setGenerating(false);
    }
  };

  const baseClasses = 'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-500',
    minimal: 'text-gray-600 hover:text-blue-600 hover:bg-blue-50 focus:ring-blue-500'
  };

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base'
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  const buttonClasses = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;

  return (
    <button
      onClick={handleClick}
      disabled={generating}
      className={buttonClasses}
      title="Cite this paper"
    >
      <Quote className={`${iconSizes[size]} mr-1.5`} />
      {generating ? 'Generating...' : 'Cite'}
    </button>
  );
};

export default CitationButton;
