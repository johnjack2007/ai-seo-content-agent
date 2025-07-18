import { WordExportService } from '@/services/WordExportService';

interface ContentDraft {
  title: string;
  content: string;
  seo_score: number;
  word_count: number;
  reading_time: number;
  keywords: string[];
  meta_description: string;
}

interface ExportFormats {
  markdown: string;
  html: string;
  word?: Buffer;
  filename: string;
}

export class ExportAgent {
  async exportContent(contentDraft: ContentDraft): Promise<ExportFormats> {
    console.log('Exporting content:', contentDraft.title);
    
    try {
      // Generate filename
      const filename = this.generateFilename(contentDraft.title);
      
      // Export to Markdown
      const markdown = this.exportToMarkdown(contentDraft);
      
      // Export to HTML
      const html = this.exportToHTML(contentDraft);
      
      // Export to Word (optional)
      let wordBuffer: Buffer | undefined;
      try {
        wordBuffer = await this.exportToWord(contentDraft);
      } catch (error) {
        console.warn('Word export failed:', error);
      }
      
      console.log('Export completed:', filename);
      
      return {
        markdown,
        html,
        word: wordBuffer,
        filename
      };
      
    } catch (error) {
      console.error('Export failed:', error);
      throw error;
    }
  }

  private generateFilename(title: string): string {
    const sanitizedTitle = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    
    const date = new Date().toISOString().split('T')[0];
    return `${sanitizedTitle}-${date}`;
  }

  private exportToMarkdown(contentDraft: ContentDraft): string {
    const { title, content, meta_description, keywords } = contentDraft;
    
    let markdown = `# ${title}\n\n`;
    
    // Add meta information
    if (meta_description) {
      markdown += `> ${meta_description}\n\n`;
    }
    
    if (keywords && keywords.length > 0) {
      markdown += `**Keywords:** ${keywords.join(', ')}\n\n`;
    }
    
    // Add content
    markdown += content;
    
    return markdown;
  }

  private exportToHTML(contentDraft: ContentDraft): string {
    const { title, content, meta_description, keywords } = contentDraft;
    
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>`;
    
    if (meta_description) {
      html += `
    <meta name="description" content="${meta_description}">`;
    }
    
    if (keywords && keywords.length > 0) {
      html += `
    <meta name="keywords" content="${keywords.join(', ')}">`;
    }
    
    html += `
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { color: #333; border-bottom: 2px solid #eee; padding-bottom: 10px; }
        .meta { background: #f9f9f9; padding: 15px; border-left: 4px solid #007cba; margin: 20px 0; }
        .keywords { color: #666; font-size: 0.9em; }
    </style>
</head>
<body>
    <h1>${title}</h1>`;
    
    if (meta_description || keywords.length > 0) {
      html += `
    <div class="meta">`;
      
      if (meta_description) {
        html += `
        <p><strong>Summary:</strong> ${meta_description}</p>`;
      }
      
      if (keywords.length > 0) {
        html += `
        <p class="keywords"><strong>Keywords:</strong> ${keywords.join(', ')}</p>`;
      }
      
      html += `
    </div>`;
    }
    
    // Convert content to HTML (basic conversion)
    const htmlContent = content
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
    
    html += `
    <p>${htmlContent}</p>
</body>
</html>`;
    
    return html;
  }

  private async exportToWord(contentDraft: ContentDraft): Promise<Buffer> {
    const { title, content, meta_description, keywords } = contentDraft;
    
    const wordData = {
      title,
      content,
      metaDescription: meta_description,
      keywords,
      author: 'AI Content Generator'
    };
    
    return await WordExportService.exportToWord(wordData);
  }
} 