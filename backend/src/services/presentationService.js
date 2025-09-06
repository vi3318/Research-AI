const debug = require("debug")("researchai:presentation");
const geminiService = require("./geminiService");
const pdfProcessorService = require("./pdfProcessorService");

class PresentationService {
  constructor() {
    this.slideTemplates = {
      title: {
        title: "Research Paper Analysis",
        subtitle: "AI-Generated Presentation",
        layout: "title"
      },
      abstract: {
        title: "Abstract Summary",
        layout: "content"
      },
      problem: {
        title: "Research Problem & Motivation",
        layout: "content"
      },
      methodology: {
        title: "Methodology Overview",
        layout: "content"
      },
      results: {
        title: "Key Results & Findings",
        layout: "content"
      },
      gaps: {
        title: "Research Gaps Identified",
        layout: "content"
      },
      conclusion: {
        title: "Conclusions & Future Work",
        layout: "content"
      },
      references: {
        title: "References & Citations",
        layout: "content"
      }
    };
  }

  // Generate PowerPoint presentation from a research paper
  async generatePresentation(paper, options = {}) {
    try {
      debug("Generating presentation for paper: %s", paper.title);
      
      // Ensure paper has required fields with fallbacks
      const safePaper = {
        title: paper.title || "Untitled Paper",
        authors: Array.isArray(paper.authors) ? paper.authors : [paper.authors || "Unknown Authors"],
        abstract: paper.abstract || "",
        year: paper.year || "Unknown Year",
        source: paper.source || "Unknown Source",
        doi: paper.doi || "No DOI",
        pdfUrl: paper.pdfUrl,
        references: paper.references || [],
        citationCount: paper.citationCount || 0
      };
      
      // Extract paper content if PDF URL is available
      let paperContent = safePaper.abstract || "";
      if (safePaper.pdfUrl && options.extractPdfContent !== false) {
        try {
          const pdfData = await pdfProcessorService.processPDF(safePaper.pdfUrl, { maxPages: 10 });
          if (pdfData && pdfData.text) {
            paperContent += "\n\n" + pdfData.text.substring(0, 5000); // Limit content size
          }
        } catch (error) {
          debug("PDF extraction failed, using abstract only: %s", error.message);
        }
      }

      // Generate slide content using AI
      const slides = await this.generateSlideContent(safePaper, paperContent, options);
      
      // Create presentation structure
      const presentation = {
        title: `Research Analysis: ${safePaper.title}`,
        author: safePaper.authors.join(", "),
        slides: slides,
        metadata: {
          paperTitle: safePaper.title,
          paperAuthors: safePaper.authors,
          paperYear: safePaper.year,
          paperDOI: safePaper.doi,
          generatedAt: new Date().toISOString(),
          source: safePaper.source
        }
      };

      debug("Presentation generated successfully with %d slides", slides.length);
      return presentation;
      
    } catch (error) {
      debug("Error generating presentation: %O", error);
      throw new Error(`Failed to generate presentation: ${error.message}`);
    }
  }

  // Generate presentation directly from PDF buffer (faster approach)
  async generatePresentationFromPDF(pdfBuffer, title, options = {}) {
    try {
      debug("Generating presentation from PDF buffer for: %s (size: %d bytes)", title, pdfBuffer.length);
      
      // Process PDF buffer directly with better error handling
      let paperContent = "";
      let extractedText = "";
      
      try {
        const pdfData = await pdfProcessorService.processPDFBuffer(pdfBuffer, { maxPages: 15 });
        if (pdfData && pdfData.text && pdfData.text.trim().length > 0) {
          extractedText = pdfData.text.trim();
          // Clean up the text - remove excessive whitespace and normalize
          paperContent = extractedText
            .replace(/\s+/g, ' ') // Replace multiple spaces with single space
            .replace(/\n\s*\n/g, '\n') // Remove empty lines
            .substring(0, 10000); // Limit content size for faster processing
          
          debug("Successfully extracted %d characters from PDF", paperContent.length);
        } else {
          throw new Error("No text content extracted from PDF");
        }
      } catch (error) {
        debug("PDF buffer processing failed: %s", error.message);
        // Create a fallback content based on the title
        paperContent = `This presentation is based on the research paper: "${title}". 
        The PDF content could not be fully extracted, but we can still provide a structured analysis based on the available information.`;
      }

      // Create paper object from extracted content
      const paper = {
        title: title || "Untitled Paper",
        authors: ["PDF Author"],
        abstract: paperContent.length > 500 ? paperContent.substring(0, 500) + "..." : paperContent,
        year: new Date().getFullYear(),
        source: "PDF Upload",
        doi: "PDF-" + Date.now(),
        content: paperContent,
        fullText: extractedText || paperContent
      };

      // Generate slide content using AI (streamlined version)
      const slides = await this.generateStreamlinedSlides(paper, paperContent, options);
      
      // Create presentation structure
      const presentation = {
        title: `Research Analysis: ${paper.title}`,
        author: paper.authors.join(", "),
        slides: slides,
        metadata: {
          paperTitle: paper.title,
          paperAuthors: paper.authors,
          paperYear: paper.year,
          paperDOI: paper.doi,
          generatedAt: new Date().toISOString(),
          source: paper.source,
          totalSlides: slides.length,
          contentLength: paperContent.length
        }
      };

      debug("PDF presentation generated successfully with %d slides", slides.length);
      return presentation;
      
    } catch (error) {
      debug("Error generating PDF presentation: %O", error);
      throw new Error(`Failed to generate PDF presentation: ${error.message}`);
    }
  }

  // Generate content for each slide using AI
  async generateSlideContent(paper, paperContent, options) {
    const slides = [];
    
    try {
      // Ensure paper has required fields with fallbacks
      const safePaper = {
        title: paper.title || "Untitled Paper",
        authors: Array.isArray(paper.authors) ? paper.authors : [paper.authors || "Unknown Authors"],
        abstract: paper.abstract || paperContent || "No abstract available",
        year: paper.year || "Unknown Year",
        source: paper.source || "Unknown Source",
        doi: paper.doi || "No DOI"
      };

      // Slide 1: Title (always available)
      slides.push({
        ...this.slideTemplates.title,
        content: {
          title: safePaper.title,
          subtitle: `by ${safePaper.authors.join(", ")}`,
          year: safePaper.year,
          source: safePaper.source,
          doi: safePaper.doi
        }
      });

      // Slide 2: Abstract Summary (with fallback)
      try {
        const abstractSummary = await this.generateAbstractSummary(safePaper, paperContent);
        const keyPoints = await this.extractKeyPoints(paperContent, "abstract");
        
        if (abstractSummary && abstractSummary !== "Abstract summary generation failed.") {
          slides.push({
            ...this.slideTemplates.abstract,
            content: {
              summary: abstractSummary,
              keyPoints: keyPoints || "Key points could not be extracted"
            }
          });
        } else {
          // Fallback: Use available abstract or skip
          if (safePaper.abstract && safePaper.abstract.length > 50) {
            slides.push({
              ...this.slideTemplates.abstract,
              content: {
                summary: safePaper.abstract.substring(0, 300) + "...",
                keyPoints: "Abstract available but AI analysis failed"
              }
            });
          }
        }
      } catch (error) {
        debug("Abstract slide generation failed, skipping: %s", error.message);
        // Skip this slide if generation fails
      }

      // Slide 3: Research Problem & Motivation (with fallback)
      try {
        const problemAnalysis = await this.analyzeResearchProblem(safePaper, paperContent);
        if (problemAnalysis.problem && problemAnalysis.problem !== "Problem analysis failed.") {
          slides.push({
            ...this.slideTemplates.problem,
            content: {
              problem: problemAnalysis.problem,
              motivation: problemAnalysis.motivation || "Motivation not identified",
              significance: problemAnalysis.significance || "Significance not identified"
            }
          });
        }
      } catch (error) {
        debug("Problem analysis slide generation failed, skipping: %s", error.message);
        // Skip this slide if generation fails
      }

      // Slide 4: Methodology (with fallback)
      try {
        const methodology = await this.extractMethodology(safePaper, paperContent);
        if (methodology.methods && methodology.methods !== "Methodology extraction failed.") {
          slides.push({
            ...this.slideTemplates.methodology,
            content: {
              methods: methodology.methods,
              approach: methodology.approach || "Approach not identified",
              techniques: methodology.techniques || "Techniques not identified"
            }
          });
        }
      } catch (error) {
        debug("Methodology slide generation failed, skipping: %s", error.message);
        // Skip this slide if generation fails
      }

      // Slide 5: Results & Findings (with fallback)
      try {
        const results = await this.extractResults(safePaper, paperContent);
        if (results.findings && results.findings !== "Results extraction failed.") {
          slides.push({
            ...this.slideTemplates.results,
            content: {
              findings: results.findings,
              outcomes: results.outcomes || "Outcomes not identified",
              impact: results.impact || "Impact not identified"
            }
          });
        }
      } catch (error) {
        debug("Results slide generation failed, skipping: %s", error.message);
        // Skip this slide if generation fails
      }

      // Slide 6: Research Gaps & Opportunities (with fallback)
      try {
        const gaps = await this.identifyResearchGaps(safePaper, paperContent);
        if (gaps.gaps && gaps.gaps !== "Gap analysis failed.") {
          slides.push({
            ...this.slideTemplates.gaps,
            content: {
              gaps: gaps.gaps,
              opportunities: gaps.opportunities || "Opportunities not identified",
              futureDirections: gaps.futureDirections || "Future directions not identified"
            }
          });
        }
      } catch (error) {
        debug("Research gaps slide generation failed, skipping: %s", error.message);
        // Skip this slide if generation fails
      }

      // Slide 7: Conclusions & Future Work (with fallback)
      try {
        const conclusions = await this.extractConclusions(safePaper, paperContent);
        if (conclusions.conclusions && conclusions.conclusions !== "Conclusions extraction failed.") {
          slides.push({
            ...this.slideTemplates.conclusion,
            content: {
              conclusions: conclusions.conclusions,
              futureWork: conclusions.futureWork || "Future work not identified",
              recommendations: conclusions.recommendations || "Recommendations not identified"
            }
          });
        }
      } catch (error) {
        debug("Conclusions slide generation failed, skipping: %s", error.message);
        // Skip this slide if generation fails
      }

      // Slide 8: References & Citations (always available with fallbacks)
      slides.push({
        ...this.slideTemplates.references,
        content: {
          references: paper.references || [],
          citations: paper.citationCount || 0,
          relatedPapers: await this.suggestRelatedPapers(safePaper).catch(() => "Related papers could not be suggested")
        }
      });

    } catch (error) {
      debug("Critical error in slide generation: %O", error);
      // Fallback: Create minimal presentation with available data
      slides.push({
        title: "Paper Information",
        layout: "content",
        content: {
          title: paper.title || "Untitled Paper",
          authors: Array.isArray(paper.authors) ? paper.authors.join(", ") : (paper.authors || "Unknown Authors"),
          abstract: paper.abstract || "Abstract not available",
          source: paper.source || "Unknown Source",
          message: "AI analysis failed, but basic paper information is available."
        }
      });
    }

    // Ensure we have at least 2 slides (title + basic info)
    if (slides.length < 2) {
      slides.push({
        title: "Paper Details",
        layout: "content",
        content: {
          message: "Limited information available for this paper.",
          paperTitle: paper.title || "Untitled",
          paperAbstract: paper.abstract || "No abstract available"
        }
      });
    }

    debug("Generated %d slides for presentation", slides.length);
    return slides;
  }

  // Generate streamlined slides for faster processing
  async generateStreamlinedSlides(paper, paperContent, options = {}) {
    const slides = [];
    
    try {
      // Slide 1: Title (always available)
      slides.push({
        title: "Research Paper Analysis",
        layout: "title",
        content: {
          title: paper.title,
          subtitle: `by ${paper.authors.join(", ")}`,
          year: paper.year,
          source: paper.source
        }
      });

      // Slide 2: Executive Summary (AI-generated)
      try {
        const summary = await this.generateExecutiveSummary(paperContent);
        slides.push({
          title: "Executive Summary",
          layout: "content",
          content: {
            summary: summary,
            keyInsights: "AI-generated insights from the paper"
          }
        });
      } catch (error) {
        debug("Executive summary generation failed, using fallback");
        slides.push({
          title: "Paper Overview",
          layout: "content",
          content: {
            summary: paper.abstract || "Content overview not available",
            keyInsights: "Paper content analysis"
          }
        });
      }

      // Slide 3: Key Findings (AI-generated)
      try {
        const findings = await this.extractKeyFindings(paperContent);
        slides.push({
          title: "Key Findings",
          layout: "content",
          content: {
            findings: findings,
            impact: "Research impact and significance"
          }
        });
      } catch (error) {
        debug("Key findings generation failed, using fallback");
        slides.push({
          title: "Main Content",
          layout: "content",
          content: {
            findings: "Key points from the paper",
            impact: "Research significance"
          }
        });
      }

      // Slide 4: Research Gaps & Opportunities (AI-generated)
      try {
        const gaps = await this.identifyResearchGaps(paper, paperContent);
        slides.push({
          title: "Research Gaps & Opportunities",
          layout: "content",
          content: {
            gaps: gaps.gaps || "Gap analysis not available",
            opportunities: gaps.opportunities || "Opportunities not identified"
          }
        });
      } catch (error) {
        debug("Research gaps generation failed, using fallback");
        slides.push({
          title: "Future Directions",
          layout: "content",
          content: {
            gaps: "Areas for future research",
            opportunities: "Research opportunities"
          }
        });
      }

      // Slide 5: Conclusions & Recommendations (AI-generated)
      try {
        const conclusions = await this.extractConclusions(paper, paperContent);
        slides.push({
          title: "Conclusions & Recommendations",
          layout: "content",
          content: {
            conclusions: conclusions.conclusions || "Conclusions not available",
            recommendations: conclusions.recommendations || "Recommendations not identified"
          }
        });
      } catch (error) {
        debug("Conclusions generation failed, using fallback");
        slides.push({
          title: "Summary",
          layout: "content",
          content: {
            conclusions: "Paper summary and conclusions",
            recommendations: "Key recommendations"
          }
        });
      }

    } catch (error) {
      debug("Critical error in streamlined slide generation: %O", error);
      // Fallback: Create minimal presentation
      slides.push({
        title: "Paper Information",
        layout: "content",
        content: {
          title: paper.title || "Untitled Paper",
          message: "AI analysis failed, but basic paper information is available.",
          content: paper.abstract || "Content not available"
        }
      });
    }

    // Ensure we have at least 3 slides
    if (slides.length < 3) {
      slides.push({
        title: "Additional Information",
        layout: "content",
        content: {
          message: "Additional analysis and insights",
          paperTitle: paper.title || "Untitled"
        }
      });
    }

    debug("Generated %d streamlined slides", slides.length);
    return slides;
  }

  // AI-powered content generation methods
  async generateAbstractSummary(paper, content) {
    try {
      const prompt = `Summarize the following research paper abstract in 2-3 concise bullet points suitable for a presentation slide:

Paper: ${paper.title}
Abstract: ${paper.abstract || content.substring(0, 1000)}

Provide a clear, academic summary with key insights.`;
      
      const response = await geminiService.generateText(prompt);
      return response || "Abstract summary generation failed.";
    } catch (error) {
      debug("Abstract summary generation failed: %s", error.message);
      return paper.abstract || "Abstract not available.";
    }
  }

  async extractKeyPoints(content, type) {
    try {
      const prompt = `Extract 3-4 key points from this ${type} content for a presentation slide:

Content: ${content.substring(0, 2000)}

Provide bullet points that highlight the most important information.`;
      
      const response = await geminiService.generateText(prompt);
      return response || "Key points extraction failed.";
    } catch (error) {
      debug("Key points extraction failed: %s", error.message);
      return "Key points could not be extracted.";
    }
  }

  async analyzeResearchProblem(paper, content) {
    try {
      const prompt = `Analyze this research paper to identify:

1. The main research problem being addressed
2. The motivation behind the research
3. The significance/impact of solving this problem

Paper: ${paper.title}
Content: ${content.substring(0, 2000)}

Provide a clear, structured analysis suitable for a presentation slide.`;
      
      const response = await geminiService.generateText(prompt);
      return {
        problem: response || "Problem analysis failed.",
        motivation: "Motivation analysis failed.",
        significance: "Significance analysis failed."
      };
    } catch (error) {
      debug("Research problem analysis failed: %s", error.message);
      return {
        problem: "Analysis failed.",
        motivation: "Analysis failed.",
        significance: "Analysis failed."
      };
    }
  }

  async extractMethodology(paper, content) {
    try {
      const prompt = `Extract the methodology information from this research paper for a presentation slide:

Paper: ${paper.title}
Content: ${content.substring(0, 2000)}

Identify:
1. The research approach/methodology used
2. Key techniques or methods employed
3. Data sources or datasets used

Provide a clear, structured summary.`;
      
      const response = await geminiService.generateText(prompt);
      return {
        methods: response || "Methodology extraction failed.",
        approach: "Approach extraction failed.",
        techniques: "Techniques extraction failed."
      };
    } catch (error) {
      debug("Methodology extraction failed: %s", error.message);
      return {
        methods: "Extraction failed.",
        approach: "Extraction failed.",
        techniques: "Extraction failed."
      };
    }
  }

  async extractResults(paper, content) {
    try {
      const prompt = `Extract the key results and findings from this research paper for a presentation slide:

Paper: ${paper.title}
Content: ${content.substring(0, 2000)}

Identify:
1. Main findings and results
2. Key metrics or measurements
3. Implications of the results

Provide a clear, structured summary.`;
      
      const response = await geminiService.generateText(prompt);
      return {
        findings: response || "Results extraction failed.",
        outcomes: "Outcomes extraction failed.",
        impact: "Impact extraction failed."
      };
    } catch (error) {
      debug("Results extraction failed: %s", error.message);
      return {
        findings: "Extraction failed.",
        outcomes: "Extraction failed.",
        impact: "Impact extraction failed."
      };
    }
  }

  async identifyResearchGaps(paper, content) {
    try {
      const prompt = `Analyze this research paper to identify research gaps and opportunities for a presentation slide:

Paper: ${paper.title}
Content: ${content.substring(0, 2000)}

Identify:
1. Research gaps or limitations mentioned
2. Opportunities for future research
3. Potential future directions

Provide a clear, structured analysis.`;
      
      const response = await geminiService.generateText(prompt);
      return {
        gaps: response || "Gap analysis failed.",
        opportunities: "Opportunities analysis failed.",
        futureDirections: "Future directions analysis failed."
      };
    } catch (error) {
      debug("Research gaps analysis failed: %s", error.message);
      return {
        gaps: "Analysis failed.",
        opportunities: "Analysis failed.",
        futureDirections: "Analysis failed."
      };
    }
  }

  async extractConclusions(paper, content) {
    try {
      const prompt = `Extract the conclusions and future work from this research paper for a presentation slide:

Paper: ${paper.title}
Content: ${content.substring(0, 2000)}

Identify:
1. Main conclusions drawn
2. Future work suggested
3. Recommendations made

Provide a clear, structured summary.`;
      
      const response = await geminiService.generateText(prompt);
      return {
        conclusions: response || "Conclusions extraction failed.",
        futureWork: "Future work extraction failed.",
        recommendations: "Recommendations extraction failed."
      };
    } catch (error) {
      debug("Conclusions extraction failed: %s", error.message);
      return {
        conclusions: "Extraction failed.",
        futureWork: "Extraction failed.",
        recommendations: "Extraction failed."
      };
    }
  }

  async suggestRelatedPapers(paper) {
    try {
      const prompt = `Suggest 3-4 related research areas or topics based on this paper:

Paper: ${paper.title}
Abstract: ${paper.abstract || ""}

Provide related research directions that would be valuable to explore.`;
      
      const response = await geminiService.generateText(prompt);
      return response || "Related papers suggestion failed.";
    } catch (error) {
      debug("Related papers suggestion failed: %s", error.message);
      return "Related papers could not be suggested.";
    }
  }

  // Fast executive summary generation
  async generateExecutiveSummary(content) {
    try {
      const prompt = `Provide a concise 2-3 sentence executive summary of this research content:

Content: ${content.substring(0, 3000)}

Focus on the main purpose, key findings, and significance.`;
      
      const response = await geminiService.generateText(prompt);
      return response || "Executive summary generation failed.";
    } catch (error) {
      debug("Executive summary generation failed: %s", error.message);
      return "Executive summary not available.";
    }
  }

  // Fast key findings extraction
  async extractKeyFindings(content) {
    try {
      const prompt = `Extract 3-4 key findings from this research content:

Content: ${content.substring(0, 3000)}

Provide bullet points highlighting the most important results and insights.`;
      
      const response = await geminiService.generateText(prompt);
      return response || "Key findings extraction failed.";
    } catch (error) {
      debug("Key findings extraction failed: %s", error.message);
      return "Key findings could not be extracted.";
    }
  }

  // Export presentation in different formats
  async exportToMarkdown(presentation) {
    let markdown = `# ${presentation.title}\n\n`;
    markdown += `**Author:** ${presentation.author}\n`;
    markdown += `**Generated:** ${presentation.metadata.generatedAt}\n\n`;
    
    presentation.slides.forEach((slide, index) => {
      markdown += `## Slide ${index + 1}: ${slide.title}\n\n`;
      
      if (slide.content) {
        Object.entries(slide.content).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            markdown += `**${key}:**\n`;
            value.forEach(item => markdown += `- ${item}\n`);
          } else {
            markdown += `**${key}:** ${value}\n\n`;
          }
        });
      }
      
      markdown += `---\n\n`;
    });
    
    return markdown;
  }

  async exportToJSON(presentation) {
    return JSON.stringify(presentation, null, 2);
  }
}

module.exports = new PresentationService(); 