'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileText, Code, File } from 'lucide-react';

interface DownloadButtonProps {
  draftId: string;
  filename: string;
  markdownUrl?: string;
  htmlUrl?: string;
  wordUrl?: string;
  disabled?: boolean;
}

export function DownloadButton({ 
  draftId, 
  filename, 
  markdownUrl, 
  htmlUrl, 
  wordUrl,
  disabled = false 
}: DownloadButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async (format: 'markdown' | 'html' | 'word') => {
    if (disabled || isDownloading) return;
    
    setIsDownloading(true);
    
    try {
      const url = format === 'markdown' ? markdownUrl : 
                  format === 'html' ? htmlUrl : 
                  format === 'word' ? wordUrl : null;
      
      if (!url) {
        console.error(`No ${format} URL available`);
        return;
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${filename}.${format === 'markdown' ? 'md' : format === 'html' ? 'html' : 'docx'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      
    } catch (error) {
      console.error('Download failed:', error);
      alert(`Failed to download ${format} file. Please try again.`);
    } finally {
      setIsDownloading(false);
    }
  };

  if (disabled) {
    return (
      <div className="flex gap-2">
        <Button disabled variant="outline" size="sm">
          <Download className="w-4 h-4 mr-2" />
          Download
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      {markdownUrl && (
        <Button 
          onClick={() => handleDownload('markdown')}
          disabled={isDownloading}
          variant="outline" 
          size="sm"
        >
          <FileText className="w-4 h-4 mr-2" />
          {isDownloading ? 'Downloading...' : 'Markdown'}
        </Button>
      )}
      
      {htmlUrl && (
        <Button 
          onClick={() => handleDownload('html')}
          disabled={isDownloading}
          variant="outline" 
          size="sm"
        >
          <Code className="w-4 h-4 mr-2" />
          {isDownloading ? 'Downloading...' : 'HTML'}
        </Button>
      )}
      
      {wordUrl && (
        <Button 
          onClick={() => handleDownload('word')}
          disabled={isDownloading}
          variant="outline" 
          size="sm"
        >
          <File className="w-4 h-4 mr-2" />
          {isDownloading ? 'Downloading...' : 'Word'}
        </Button>
      )}
      
      {!markdownUrl && !htmlUrl && !wordUrl && (
        <Button disabled variant="outline" size="sm">
          <Download className="w-4 h-4 mr-2" />
          No Downloads Available
        </Button>
      )}
    </div>
  );
} 