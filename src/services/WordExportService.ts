import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } from 'docx';

export interface WordExportOptions {
  title: string;
  content: string;
  author?: string;
  keywords?: string[];
  metaDescription?: string;
}

export class WordExportService {
  /**
   * Convert content to Word document format
   */
  static async exportToWord(options: WordExportOptions): Promise<Buffer> {
    const { title, content, author = 'AI Content Generator', keywords = [], metaDescription = '' } = options;

    // Parse content into sections
    const sections = this.parseContentIntoSections(content);

    // Create document
    const doc = new Document({
      creator: author,
      title: title,
      description: metaDescription,
      keywords: keywords.join(', '),
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1440, // 1 inch
                right: 1440,
                bottom: 1440,
                left: 1440,
              },
            },
          },
          children: [
            // Title
            new Paragraph({
              text: title,
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              spacing: {
                after: 400,
                before: 200,
              },
            }),

            // Meta information
            ...this.createMetaInfoParagraphs(author, keywords, metaDescription),

            // Content sections
            ...this.createContentParagraphs(sections),
          ],
        },
      ],
    });

    // Generate the document
    return await Packer.toBuffer(doc);
  }

  /**
   * Parse content into logical sections
   */
  private static parseContentIntoSections(content: string): Array<{ type: 'heading' | 'paragraph' | 'list'; content: string; level?: number }> {
    const lines = content.split('\n').filter(line => line.trim());
    const sections: Array<{ type: 'heading' | 'paragraph' | 'list'; content: string; level?: number }> = [];

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Detect headings (lines that start with # or are short and end with :)
      if (trimmedLine.startsWith('#')) {
        const level = (trimmedLine.match(/^#+/)?.[0].length || 1);
        const headingText = trimmedLine.replace(/^#+\s*/, '');
        sections.push({
          type: 'heading',
          content: headingText,
          level: Math.min(level, 3) // Limit to 3 levels
        });
      } else if (trimmedLine.length < 100 && trimmedLine.endsWith(':') && !trimmedLine.includes('.')) {
        sections.push({
          type: 'heading',
          content: trimmedLine.slice(0, -1), // Remove the colon
          level: 2
        });
      } else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('• ') || trimmedLine.startsWith('* ')) {
        // List items
        sections.push({
          type: 'list',
          content: trimmedLine.replace(/^[-•*]\s*/, '')
        });
      } else {
        // Regular paragraph
        sections.push({
          type: 'paragraph',
          content: trimmedLine
        });
      }
    }

    return sections;
  }

  /**
   * Create meta information paragraphs
   */
  private static createMetaInfoParagraphs(author: string, keywords: string[], metaDescription: string): Paragraph[] {
    const paragraphs: Paragraph[] = [];

    if (metaDescription) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Description: ',
              bold: true,
              size: 20,
            }),
            new TextRun({
              text: metaDescription,
              size: 20,
            }),
          ],
          spacing: {
            after: 200,
          },
        })
      );
    }

    if (keywords.length > 0) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Keywords: ',
              bold: true,
              size: 20,
            }),
            new TextRun({
              text: keywords.join(', '),
              size: 20,
            }),
          ],
          spacing: {
            after: 200,
          },
        })
      );
    }

    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Author: ',
            bold: true,
            size: 20,
          }),
          new TextRun({
            text: author,
            size: 20,
          }),
        ],
        spacing: {
          after: 400,
        },
      })
    );

    return paragraphs;
  }

  /**
   * Create content paragraphs from sections
   */
  private static createContentParagraphs(sections: Array<{ type: 'heading' | 'paragraph' | 'list'; content: string; level?: number }>): Paragraph[] {
    const paragraphs: Paragraph[] = [];

    for (const section of sections) {
      switch (section.type) {
        case 'heading':
          const headingLevel = section.level === 1 ? HeadingLevel.HEADING_1 : 
                              section.level === 2 ? HeadingLevel.HEADING_2 : 
                              HeadingLevel.HEADING_3;
          
          paragraphs.push(
            new Paragraph({
              text: section.content,
              heading: headingLevel,
              spacing: {
                after: 200,
                before: 300,
              },
            })
          );
          break;

        case 'list':
          paragraphs.push(
            new Paragraph({
              text: `• ${section.content}`,
              spacing: {
                after: 100,
              },
              indent: {
                left: 720, // 0.5 inch
              },
            })
          );
          break;

        case 'paragraph':
          paragraphs.push(
            new Paragraph({
              text: section.content,
              spacing: {
                after: 200,
              },
            })
          );
          break;
      }
    }

    return paragraphs;
  }

  /**
   * Generate filename for the Word document
   */
  static generateFilename(title: string): string {
    const sanitizedTitle = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    
    const date = new Date().toISOString().split('T')[0];
    return `${sanitizedTitle}-${date}.docx`;
  }
} 