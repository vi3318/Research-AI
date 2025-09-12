const PptxGenJS = require('pptxgenjs');
const { createCanvas } = require('canvas');
const fs = require('fs').promises;
const path = require('path');
const debug = require('debug')('researchai:auto-ppt-generator');

class AutoPptGenerator {
  constructor() {
    this.themes = {
      minimal: {
        background: '#FFFFFF',
        primary: '#2563EB',
        secondary: '#64748B',
        accent: '#F59E0B',
        text: '#1E293B',
        textLight: '#64748B',
        fontFamily: 'Segoe UI'
      },
      academic: {
        background: '#FEFEFE',
        primary: '#1E40AF',
        secondary: '#374151',
        accent: '#DC2626',
        text: '#111827',
        textLight: '#6B7280',
        fontFamily: 'Times New Roman'
      },
      corporate: {
        background: '#F8FAFC',
        primary: '#0F172A',
        secondary: '#475569',
        accent: '#059669',
        text: '#0F172A',
        textLight: '#64748B',
        fontFamily: 'Calibri'
      },
      modern: {
        background: '#0F172A',
        primary: '#60A5FA',
        secondary: '#94A3B8',
        accent: '#10B981',
        text: '#F8FAFC',
        textLight: '#CBD5E1',
        fontFamily: 'Arial'
      },
      vibrant: {
        background: '#FFFFFF',
        primary: '#7C3AED',
        secondary: '#6366F1',
        accent: '#F59E0B',
        text: '#1F2937',
        textLight: '#6B7280',
        fontFamily: 'Segoe UI'
      }
    };
  }

  /**
   * Generate PowerPoint presentation from slides data
   */
  async generatePresentation(slides, options = {}) {
    try {
      debug('Generating PowerPoint presentation...');
      
      const {
        title = 'Research Presentation',
        author = 'AI Generated',
        theme = 'minimal'
      } = options;

      // Create presentation
      const pptx = new PptxGenJS();
      const selectedTheme = this.themes[theme] || this.themes.minimal;

      // Set presentation properties
      pptx.author = author;
      pptx.company = 'Research AI';
      pptx.subject = title;
      pptx.title = title;

      // Apply theme
      pptx.defineLayout({
        name: 'CUSTOM',
        width: 10,
        height: 5.625
      });

      // Generate slides
      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i];
        await this.generateSlide(pptx, slide, selectedTheme, i);
      }

      debug(`Generated presentation with ${slides.length} slides`);
      return pptx;
    } catch (error) {
      debug('Error generating presentation:', error);
      throw new Error(`Presentation generation failed: ${error.message}`);
    }
  }

  /**
   * Generate individual slide based on type
   */
  async generateSlide(pptx, slideData, theme, index) {
    try {
      const slide = pptx.addSlide();
      
      // Set slide background
      slide.background = { color: theme.background };

      switch (slideData.type) {
        case 'title':
          await this.generateTitleSlide(slide, slideData, theme);
          break;
        case 'overview':
          await this.generateOverviewSlide(slide, slideData, theme);
          break;
        case 'content':
          await this.generateContentSlide(slide, slideData, theme);
          break;
        case 'methodology':
          await this.generateMethodologySlide(slide, slideData, theme);
          break;
        case 'results':
          await this.generateResultsSlide(slide, slideData, theme);
          break;
        case 'conclusion':
          await this.generateConclusionSlide(slide, slideData, theme);
          break;
        default:
          await this.generateContentSlide(slide, slideData, theme);
      }

      // Add slide number
      slide.addText(`${index + 1}`, {
        x: 9.5,
        y: 5.2,
        w: 0.5,
        h: 0.3,
        fontSize: 10,
        color: theme.textLight,
        align: 'center'
      });

    } catch (error) {
      debug('Error generating slide:', error);
      throw error;
    }
  }

  /**
   * Generate title slide
   */
  async generateTitleSlide(slide, slideData, theme) {
    // Set slide background
    slide.background = { color: theme.background };
    
    // Main title
    slide.addText(slideData.title, {
      x: 0.5,
      y: 1.5,
      w: 9,
      h: 1.5,
      fontSize: 36,
      bold: true,
      color: theme.primary,
      align: 'center',
      fontFace: theme.fontFamily || 'Arial',
      valign: 'middle'
    });

    // Subtitle/Abstract
    if (slideData.content) {
      slide.addText(slideData.content, {
        x: 1,
        y: 3.2,
        w: 8,
        h: 1.8,
        fontSize: 18,
        color: theme.text,
        align: 'center',
        fontFace: theme.fontFamily || 'Arial',
        valign: 'top'
      });
    }

    // Authors section
    if (slideData.authors) {
      slide.addText(`Authors: ${slideData.authors}`, {
        x: 1,
        y: 5.2,
        w: 8,
        h: 0.8,
        fontSize: 16,
        color: theme.secondary,
        align: 'center',
        fontFace: theme.fontFamily || 'Arial',
        italic: true
      });
    }

    // Decorative elements
    slide.addShape('rect', {
      x: 2,
      y: 3.0,
      w: 6,
      h: 0.05,
      fill: { color: theme.accent }
    });

    // Side accent bar
    slide.addShape('rect', {
      x: 0,
      y: 0,
      w: 0.2,
      h: 7.5,
      fill: { color: theme.accent }
    });
  }

  /**
   * Generate overview slide
   */
  async generateOverviewSlide(slide, slideData, theme) {
    // Title
    slide.addText(slideData.title, {
      x: 0.5,
      y: 0.5,
      w: 9,
      h: 0.8,
      fontSize: 28,
      bold: true,
      color: theme.primary,
      fontFace: 'Arial'
    });

    // Content
    slide.addText(slideData.content, {
      x: 1,
      y: 1.5,
      w: 8,
      h: 3.5,
      fontSize: 16,
      color: theme.text,
      fontFace: 'Arial',
      bullet: { type: 'bullet' }
    });

    // Background accent
    slide.addShape('rect', {
      x: 0,
      y: 0,
      w: 0.3,
      h: 5.625,
      fill: { color: theme.accent }
    });
  }

  /**
   * Generate content slide with bullet points and optional image placeholder
   */
  async generateContentSlide(slide, slideData, theme) {
    // Title
    slide.addText(slideData.title, {
      x: 0.5,
      y: 0.3,
      w: 9,
      h: 0.8,
      fontSize: 28,
      bold: true,
      color: theme.primary,
      align: 'left',
      fontFace: theme.fontFamily || 'Arial'
    });

    // Check if this slide should have an image placeholder
    const hasImagePlaceholder = slideData.hasImagePlaceholder || false;
    const contentWidth = hasImagePlaceholder ? 5.5 : 9;
    const contentX = 0.5;

    // Content with bullet points
    if (slideData.content) {
      // Format content for better bullet points
      const formattedContent = this.formatSlideContent(slideData.content);
      
      slide.addText(formattedContent, {
        x: contentX,
        y: 1.3,
        w: contentWidth,
        h: 3.8,
        fontSize: 16,
        color: theme.text,
        align: 'left',
        fontFace: theme.fontFamily || 'Arial',
        valign: 'top',
        bullet: { type: 'bullet', style: '•' }
      });
    }

    // Add image placeholder if needed
    if (hasImagePlaceholder) {
      this.addImagePlaceholder(slide, theme, {
        x: 6.2,
        y: 1.3,
        w: 3.3,
        h: 2.5
      });
      
      // Add caption below image
      slide.addText('[Insert relevant chart, graph, or diagram]', {
        x: 6.2,
        y: 4,
        w: 3.3,
        h: 0.5,
        fontSize: 10,
        color: theme.textLight,
        align: 'center',
        fontFace: theme.fontFamily || 'Arial',
        italic: true
      });
    }
  }

  /**
   * Add image placeholder to slide
   */
  addImagePlaceholder(slide, theme, position) {
    // Add placeholder rectangle
    slide.addShape('RECTANGLE', {
      x: position.x,
      y: position.y,
      w: position.w,
      h: position.h,
      fill: { color: theme.background },
      line: { color: theme.secondary, width: 2, dashType: 'dash' }
    });

    // Add placeholder text
    slide.addText('📊\nImage/Chart\nPlaceholder', {
      x: position.x,
      y: position.y + (position.h / 2) - 0.4,
      w: position.w,
      h: 0.8,
      fontSize: 14,
      color: theme.secondary,
      align: 'center',
      fontFace: theme.fontFamily || 'Arial',
      valign: 'middle'
    });
  }

  /**
   * Format slide content for better presentation
   */
  formatSlideContent(content) {
    if (!content) return '';
    
    // If content already has bullet points, clean them up
    if (content.includes('•')) {
      return content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => {
          // Remove existing bullets and clean up
          const cleanLine = line.replace(/^[•\-\*]\s*/, '').trim();
          return cleanLine;
        })
        .join('\n');
    }
    
    // Split long content into bullet points
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
    if (sentences.length > 1) {
      return sentences
        .slice(0, 5) // Limit to 5 points per slide
        .map(s => s.trim())
        .filter(s => s.length > 0)
        .join('\n');
    }
    
    return content;
  }

  /**
   * Generate methodology slide with flow diagram suggestion
   */
  async generateMethodologySlide(slide, slideData, theme) {
    // Title
    slide.addText(slideData.title, {
      x: 0.5,
      y: 0.5,
      w: 9,
      h: 0.8,
      fontSize: 24,
      bold: true,
      color: theme.primary,
      fontFace: 'Arial'
    });

    // Split content for layout
    const contentLines = slideData.content.split('\n').filter(line => line.trim());
    const halfPoint = Math.ceil(contentLines.length / 2);
    const leftContent = contentLines.slice(0, halfPoint).join('\n');
    const rightContent = contentLines.slice(halfPoint).join('\n');

    // Left side content
    slide.addText(leftContent, {
      x: 0.5,
      y: 1.5,
      w: 4.5,
      h: 3.5,
      fontSize: 16,
      color: theme.text,
      fontFace: 'Arial',
      bullet: { type: 'bullet' }
    });

    // Right side - methodology flow visualization
    if (rightContent) {
      slide.addText(rightContent, {
        x: 5.5,
        y: 1.5,
        w: 4,
        h: 3.5,
        fontSize: 16,
        color: theme.text,
        fontFace: 'Arial',
        bullet: { type: 'bullet' }
      });
    } else {
      // Add a simple flow diagram placeholder
      slide.addText('Methodology Flow', {
        x: 5.5,
        y: 1.5,
        w: 4,
        h: 0.5,
        fontSize: 14,
        bold: true,
        color: theme.secondary,
        fontFace: 'Arial',
        align: 'center'
      });

      // Simple flow boxes
      const flowSteps = ['Input', 'Process', 'Output'];
      flowSteps.forEach((step, index) => {
        slide.addShape('rect', {
          x: 6,
          y: 2.2 + (index * 0.8),
          w: 3,
          h: 0.5,
          fill: { color: theme.accent },
          line: { color: theme.primary, width: 1 }
        });
        
        slide.addText(step, {
          x: 6,
          y: 2.2 + (index * 0.8),
          w: 3,
          h: 0.5,
          fontSize: 12,
          color: '#FFFFFF',
          fontFace: 'Arial',
          align: 'center',
          valign: 'middle'
        });

        // Arrow between steps
        if (index < flowSteps.length - 1) {
          slide.addShape('line', {
            x: 7.5,
            y: 2.7 + (index * 0.8),
            w: 0,
            h: 0.3,
            line: { color: theme.primary, width: 2, endArrowType: 'triangle' }
          });
        }
      });
    }
  }

  /**
   * Generate results slide with chart placeholder
   */
  async generateResultsSlide(slide, slideData, theme) {
    // Title
    slide.addText(slideData.title, {
      x: 0.5,
      y: 0.5,
      w: 9,
      h: 0.8,
      fontSize: 24,
      bold: true,
      color: theme.primary,
      fontFace: 'Arial'
    });

    // Content on left side
    slide.addText(slideData.content, {
      x: 0.5,
      y: 1.5,
      w: 4.5,
      h: 3.5,
      fontSize: 16,
      color: theme.text,
      fontFace: 'Arial',
      bullet: { type: 'bullet' }
    });

    // Chart placeholder on right side
    slide.addShape('rect', {
      x: 5.5,
      y: 1.5,
      w: 4,
      h: 3,
      fill: { color: theme.background },
      line: { color: theme.secondary, width: 1, dashType: 'dash' }
    });

    slide.addText('Chart/Visualization\n[Auto-generated based on results]', {
      x: 5.5,
      y: 2.5,
      w: 4,
      h: 1,
      fontSize: 14,
      color: theme.textLight,
      fontFace: 'Arial',
      align: 'center',
      valign: 'middle',
      italic: true
    });
  }

  /**
   * Generate conclusion slide
   */
  async generateConclusionSlide(slide, slideData, theme) {
    // Title
    slide.addText(slideData.title, {
      x: 0.5,
      y: 0.5,
      w: 9,
      h: 0.8,
      fontSize: 28,
      bold: true,
      color: theme.primary,
      fontFace: 'Arial'
    });

    // Content with emphasis
    slide.addText(slideData.content, {
      x: 1,
      y: 1.8,
      w: 8,
      h: 3,
      fontSize: 18,
      color: theme.text,
      fontFace: 'Arial',
      bullet: { type: 'bullet' }
    });

    // Bottom accent
    slide.addShape('rect', {
      x: 0,
      y: 5.325,
      w: 10,
      h: 0.3,
      fill: { color: theme.accent }
    });
  }

  /**
   * Export presentation to buffer
   */
  async exportToBuffer(pptx) {
    try {
      debug('Exporting presentation to buffer...');
      const buffer = await pptx.write('nodebuffer');
      debug('Presentation exported successfully');
      return buffer;
    } catch (error) {
      debug('Error exporting presentation:', error);
      throw new Error(`Export failed: ${error.message}`);
    }
  }

  /**
   * Get available themes
   */
  getAvailableThemes() {
    return Object.keys(this.themes);
  }
}

module.exports = AutoPptGenerator;
