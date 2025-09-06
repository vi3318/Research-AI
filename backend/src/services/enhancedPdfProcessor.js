const pdfParse = require('pdf-parse');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const debug = require('debug')('researchai:enhanced-pdf-processor');

class EnhancedPdfProcessor {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }

  /**
   * Extract structured content from PDF
   */
  async extractStructuredContent(buffer) {
    try {
      debug('Starting PDF extraction...');
      
      // Extract raw text from PDF
      const data = await pdfParse(buffer);
      const fullText = data.text;
      
      debug(`Extracted ${fullText.length} characters from PDF`);
      
      // Split into sections using AI
      const sections = await this.detectSections(fullText);
      
      return {
        fullText,
        sections,
        metadata: {
          pages: data.numpages,
          extractedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      debug('Error in PDF extraction:', error);
      throw new Error(`PDF processing failed: ${error.message}`);
    }
  }

  /**
   * Use AI to detect and split paper into logical sections
   */
  async detectSections(fullText) {
    try {
      debug('Detecting sections with AI...');
      
      const prompt = `
        Analyze this research paper text and split it into logical sections.
        Return a JSON object with sections: title, authors, abstract, introduction, methodology, results, conclusion, and references.
        
        For each section, extract the relevant text content. If a section is not found, return an empty string.
        For authors, extract the author names as they appear near the title, formatted as "Author1, Author2, Author3".
        
        Text to analyze:
        ${fullText.substring(0, 8000)} // Limit to first 8000 chars for API limits
        
        Return format:
        {
          "title": "extracted title",
          "authors": "Author1, Author2, Author3",
          "abstract": "abstract content...",
          "introduction": "introduction content...",
          "methodology": "methodology content...",
          "results": "results content...",
          "conclusion": "conclusion content...",
          "references": "references content..."
        }
      `;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Parse AI response as JSON
      try {
        const sections = JSON.parse(text.replace(/```json|```/g, '').trim());
        debug('Successfully detected sections:', Object.keys(sections));
        return sections;
      } catch (parseError) {
        debug('Failed to parse AI response as JSON, using fallback section detection');
        return this.fallbackSectionDetection(fullText);
      }
    } catch (error) {
      debug('AI section detection failed, using fallback:', error);
      return this.fallbackSectionDetection(fullText);
    }
  }

  /**
   * Fallback section detection using regex patterns
   */
  fallbackSectionDetection(text) {
    const sections = {
      title: '',
      abstract: '',
      introduction: '',
      methodology: '',
      results: '',
      conclusion: '',
      references: ''
    };

    // Simple regex-based section detection
    const patterns = {
      title: /^(.{1,100})\n/,
      abstract: /(?:abstract|summary)[\s:]*\n?(.*?)(?=\n\s*(?:introduction|1\.|keywords|key words))/is,
      introduction: /(?:introduction|1\.)[\s:]*\n?(.*?)(?=\n\s*(?:method|2\.|related work|background))/is,
      methodology: /(?:method|methodology|approach|2\.)[\s:]*\n?(.*?)(?=\n\s*(?:result|3\.|experiment|evaluation))/is,
      results: /(?:result|finding|3\.)[\s:]*\n?(.*?)(?=\n\s*(?:conclusion|4\.|discussion|limitation))/is,
      conclusion: /(?:conclusion|4\.)[\s:]*\n?(.*?)(?=\n\s*(?:reference|acknowledgment|5\.))/is,
      references: /(?:reference|bibliography)[\s:]*\n?(.*?)$/is
    };

    for (const [section, pattern] of Object.entries(patterns)) {
      const match = text.match(pattern);
      if (match) {
        sections[section] = match[1] ? match[1].trim().substring(0, 1000) : '';
      }
    }

    // Extract title from first line if not found
    if (!sections.title) {
      const firstLines = text.split('\n').slice(0, 3).join(' ');
      sections.title = firstLines.trim().substring(0, 100);
    }

    return sections;
  }

  /**
   * Generate slide summaries for each section
   */
  async generateSlideSummaries(sections) {
    try {
      debug('Generating slide summaries...');
      
      const slides = [];
      
      // Title slide
      if (sections.title) {
        slides.push({
          type: 'title',
          title: sections.title,
          content: sections.abstract ? sections.abstract.substring(0, 200) + '...' : '',
          authors: sections.authors || 'Authors not identified',
          layout: 'title'
        });
      }

      // Process each section
      const sectionMappings = [
        { key: 'abstract', title: 'Abstract', type: 'overview' },
        { key: 'introduction', title: 'Introduction', type: 'content' },
        { key: 'methodology', title: 'Methodology', type: 'methodology' },
        { key: 'results', title: 'Results', type: 'results' },
        { key: 'conclusion', title: 'Conclusion', type: 'conclusion' }
      ];

      for (const mapping of sectionMappings) {
        if (sections[mapping.key] && sections[mapping.key].trim()) {
          const summary = await this.summarizeSection(sections[mapping.key], mapping.type);
          slides.push({
            type: mapping.type,
            title: mapping.title,
            content: summary,
            layout: mapping.type === 'results' ? 'content-chart' : 'content'
          });
        }
      }

      debug(`Generated ${slides.length} slides`);
      return slides;
    } catch (error) {
      debug('Error generating slide summaries:', error);
      throw error;
    }
  }

  /**
   * Summarize a section into slide-appropriate content
   */
  async summarizeSection(sectionText, sectionType) {
    try {
      const prompts = {
        overview: `Summarize this abstract/overview into exactly 4 concise bullet points suitable for a PowerPoint slide:`,
        content: `Convert this section into exactly 4-5 bullet points for a presentation slide:`,
        methodology: `Summarize this methodology into exactly 4 clear steps or bullet points:`,
        results: `Convert these findings into exactly 3-4 key bullet points with specific findings:`,
        conclusion: `Summarize these conclusions into exactly 3-4 impactful bullet points:`
      };

      const prompt = `
        ${prompts[sectionType] || prompts.content}
        
        Section content:
        ${sectionText.substring(0, 2000)}
        
        IMPORTANT REQUIREMENTS:
        1. Return EXACTLY the number of bullet points specified above
        2. Each bullet point should be a complete, meaningful statement
        3. Start each line with "•" followed by a space
        4. Keep each point between 15-25 words
        5. Focus on the most important insights and findings
        6. Do not include any other text, headers, or formatting
        
        Example format:
        • First key point about the research findings
        • Second important insight from this section
        • Third significant contribution or method
        • Fourth relevant detail or conclusion
      `;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      let summary = response.text();

      // Clean up the response
      summary = summary.replace(/```|markdown/g, '').trim();
      
      // Ensure proper bullet point formatting
      const lines = summary.split('\n').filter(line => line.trim());
      const bulletPoints = lines.map(line => {
        const cleanLine = line.replace(/^[•\-\*\d\.\)\s]*/, '').trim();
        return cleanLine ? `• ${cleanLine}` : null;
      }).filter(Boolean);

      // Ensure we have at least 3 bullet points
      if (bulletPoints.length < 3) {
        const sentences = sectionText.split(/[.!?]+/).filter(s => s.trim().length > 20);
        for (let i = bulletPoints.length; i < 3 && i < sentences.length; i++) {
          bulletPoints.push(`• ${sentences[i].trim().substring(0, 100)}`);
        }
      }

      return bulletPoints.join('\n');
    } catch (error) {
      debug('Error summarizing section:', error);
      // Return a fallback summary with multiple points
      const sentences = sectionText.split(/[.!?]+/).filter(s => s.trim().length > 20);
      const fallbackPoints = sentences.slice(0, 3).map((sentence, i) => 
        `• ${sentence.trim().substring(0, 80)}...`
      );
      return fallbackPoints.join('\n');
    }
  }
}

module.exports = EnhancedPdfProcessor;
