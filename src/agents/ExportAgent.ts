import { WordExportService } from '../services/WordExportService';

interface ExportOptions {
  format: 'markdown' | 'html' | 'word' | 'all';
  includeMetadata?: boolean;
  filename?: string;
  keywords?: string[];
  metaDescription?: string;
}

interface ExportedContent {
  markdown?: string;
  html?: string;
  word?: Buffer;
  filename: string;
}

export class ExportAgent {
  
  // Main export method
  async exportContent(
    title: string,
    content: string,
    topic: string,
    options: ExportOptions = { format: 'all' }
  ): Promise<ExportedContent> {
    console.log(`Exporting content: ${title}`);
    
    const filename = this.generateFilename(title, topic);
    const result: ExportedContent = { filename };
    
    try {
      if (options.format === 'markdown' || options.format === 'all') {
        result.markdown = this.convertToMarkdown(title, content, topic, options);
      }
      
      if (options.format === 'html' || options.format === 'all') {
        result.html = this.convertToHTML(title, content, topic, options);
      }
      
      if (options.format === 'word' || options.format === 'all') {
        result.word = await this.convertToWord(title, content, topic, options);
      }
      
      console.log(`Export completed: ${filename}`);
      return result;
      
    } catch (error) {
      console.error('Export failed:', error);
      throw error;
    }
  }

  // Convert content to Markdown format
  private convertToMarkdown(
    title: string,
    content: string,
    topic: string,
    options: ExportOptions
  ): string {
    let markdown = '';
    
    // Add metadata if requested
    if (options.includeMetadata) {
      markdown += this.generateMarkdownMetadata(title, topic);
    }
    
    // Add title
    markdown += `# ${title}\n\n`;
    
    // Convert content to markdown
    const markdownContent = this.contentToMarkdown(content);
    markdown += markdownContent;
    
    // Add footer
    markdown += this.generateMarkdownFooter(topic);
    
    return markdown;
  }

  // Convert content to HTML format
  private convertToHTML(
    title: string,
    content: string,
    topic: string,
    options: ExportOptions
  ): string {
    let html = '';
    
    // Add HTML header
    html += this.generateHTMLHeader(title, topic);
    
    // Add title
    html += `<h1>${this.escapeHTML(title)}</h1>\n\n`;
    
    // Convert content to HTML
    const htmlContent = this.contentToHTML(content);
    html += htmlContent;
    
    // Add footer
    html += this.generateHTMLFooter(topic);
    
    // Close HTML
    html += '</article>\n</body>\n</html>';
    
    return html;
  }

  // Convert content to Word document format
  private async convertToWord(
    title: string,
    content: string,
    topic: string,
    options: ExportOptions
  ): Promise<Buffer> {
    return await WordExportService.exportToWord({
      title,
      content,
      author: 'AI SEO Content Agent',
      keywords: options.keywords || [topic],
      metaDescription: options.metaDescription || `Content about ${topic}`
    });
  }

  // Generate markdown metadata
  private generateMarkdownMetadata(title: string, topic: string): string {
    const date = new Date().toISOString().split('T')[0];
    return `---
title: "${title}"
topic: "${topic}"
date: "${date}"
author: "AI SEO Content Agent"
---

`;
  }

  // Generate markdown footer
  private generateMarkdownFooter(topic: string): string {
    return `\n\n---\n\n*This content was generated using AI SEO Content Agent for the topic: ${topic}*\n`;
  }

  // Generate HTML header
  private generateHTMLHeader(title: string, topic: string): string {
    const date = new Date().toISOString().split('T')[0];
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.escapeHTML(title)}</title>
    <meta name="description" content="Content about ${this.escapeHTML(topic)}">
    <meta name="author" content="AI SEO Content Agent">
    <meta name="date" content="${date}">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
        h2 { color: #34495e; margin-top: 30px; }
        h3 { color: #7f8c8d; }
        p { margin-bottom: 16px; }
        ul, ol { margin-bottom: 16px; }
        li { margin-bottom: 8px; }
        blockquote { border-left: 4px solid #3498db; padding-left: 20px; margin: 20px 0; font-style: italic; }
        code { background-color: #f8f9fa; padding: 2px 4px; border-radius: 3px; }
        pre { background-color: #f8f9fa; padding: 15px; border-radius: 5px; overflow-x: auto; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ecf0f1; font-size: 0.9em; color: #7f8c8d; }
    </style>
</head>
<body>
<article>
`;
  }

  // Generate HTML footer
  private generateHTMLFooter(topic: string): string {
    return `\n<div class="footer">
    <p><em>This content was generated using AI SEO Content Agent for the topic: ${this.escapeHTML(topic)}</em></p>
</div>
`;
  }

  // Convert content to markdown format
  private contentToMarkdown(content: string): string {
    // Split content into sections
    const sections = content.split(/\n(?=#)/);
    
    return sections.map(section => {
      // Convert headers
      let markdown = section
        .replace(/^# (.+)$/gm, '# $1')
        .replace(/^## (.+)$/gm, '## $1')
        .replace(/^### (.+)$/gm, '### $1');
      
      // Convert lists
      markdown = markdown
        .replace(/^• (.+)$/gm, '- $1')
        .replace(/^(\d+)\. (.+)$/gm, '$1. $2');
      
      // Convert emphasis
      markdown = markdown
        .replace(/\*\*(.+?)\*\*/g, '**$1**')
        .replace(/\*(.+?)\*/g, '*$1*');
      
      // Convert links
      markdown = markdown.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '[$1]($2)');
      
      return markdown;
    }).join('\n\n');
  }

  // Convert content to HTML format
  private contentToHTML(content: string): string {
    // Split content into sections
    const sections = content.split(/\n(?=#)/);
    
    return sections.map(section => {
      // Convert headers
      let html = section
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^### (.+)$/gm, '<h3>$1</h3>');
      
      // Convert paragraphs
      html = html.replace(/^(?!<[h|u|o])(.+)$/gm, '<p>$1</p>');
      
      // Convert lists
      html = html
        .replace(/^• (.+)$/gm, '<li>$1</li>')
        .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>');
      
      // Wrap consecutive list items in ul/ol tags
      html = html.replace(/(<li>.*<\/li>)/g, '<ul>$1</ul>');
      
      // Convert emphasis
      html = html
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>');
      
      // Convert links
      html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
      
      // Clean up empty paragraphs
      html = html.replace(/<p><\/p>/g, '');
      
      return html;
    }).join('\n\n');
  }

  // Generate filename
  private generateFilename(title: string, topic: string): string {
    const date = new Date().toISOString().split('T')[0];
    const cleanTitle = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
    
    return `${cleanTitle}-${date}`;
  }

  // Escape HTML special characters
  private escapeHTML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Create download blob for browser download
  createDownloadBlob(content: string, filename: string, mimeType: string): Blob {
    return new Blob([content], { type: mimeType });
  }

  // Get MIME type for format
  getMimeType(format: 'markdown' | 'html'): string {
    return format === 'markdown' ? 'text/markdown' : 'text/html';
  }
} 