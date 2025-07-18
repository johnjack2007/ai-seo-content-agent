'use client';

// Force dynamic rendering to prevent static generation issues
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AuthModal } from '@/components/AuthModal';
import { PastDrafts } from '@/components/PastDrafts';
import { 
  FileText, 
  BarChart3, 
  Calendar, 
  Search, 
  Zap, 
  Target, 
  Users, 
  TrendingUp,
  Plus,
  Upload,
  Sparkles,
  LogOut,
  User,
  Download,
  Play
} from 'lucide-react';
import { User as UserType, getCurrentUser, onAuthStateChange, signOut } from '@/lib/auth';
import { DownloadButton } from '@/components/DownloadButton';

export default function HomePage() {
  const [user, setUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [activeTab, setActiveTab] = useState('generate');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState<any>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [formData, setFormData] = useState({
    topic: '',
    content_purpose: 'informational',
    content_type: 'blog',
    audience: 'general',
    tone: 'professional',
    seo_keywords: '',
    due_date: '',
    word_count: 500
  });

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadMessage, setUploadMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // Check current user
    getCurrentUser()
      .then(user => {
        if (user) {
          setUser({
            id: user.id,
            email: user.email!,
            name: user.user_metadata?.name,
          });
        }
      })
      .catch(() => {
        // User not authenticated
      })
      .finally(() => {
        setLoading(false);
      });

    // Listen for auth state changes
    const { data: { subscription } } = onAuthStateChange((user) => {
      setUser(user);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      setUser(null);
      setIsDemoMode(false);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const enableDemoMode = () => {
    setIsDemoMode(true);
    setUser({
      id: 'demo-user-123',
      email: 'demo@example.com',
      name: 'Demo User',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user && !isDemoMode) {
      setShowAuthModal(true);
      return;
    }

    setIsGenerating(true);
    setGenerationResult(null);
    setError(''); // Clear previous errors

    if (formData.word_count < 100) {
      setError('Content length must be at least 100 words.');
      setIsGenerating(false);
      return;
    }

    try {
      const keywords = formData.seo_keywords
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0);

      const response = await fetch('/api/content/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: formData.topic,
          content_purpose: formData.content_purpose,
          content_type: formData.content_type,
          audience: formData.audience,
          tone: formData.tone,
          seo_keywords: keywords,
          due_date: formData.due_date,
          word_count: formData.word_count,
          workspace_id: isDemoMode ? 'demo-workspace' : user?.id || '',
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setGenerationResult(result);
        
        // Save to local storage for demo mode
        if (isDemoMode && result.data?.draft) {
          const demoDrafts = JSON.parse(localStorage.getItem('demo-drafts') || '[]');
          const newDraft = {
            id: result.data.draft.id,
            title: result.data.draft.title,
            content: result.data.draft.content,
            content_type: formData.content_type,
            topic: formData.topic,
            created_at: new Date().toISOString(),
            seo_score: result.data.seo_score,
            keywords: keywords,
            word_count: result.data.word_count,
            reading_time: result.data.reading_time
          };
          demoDrafts.unshift(newDraft); // Add to beginning
          localStorage.setItem('demo-drafts', JSON.stringify(demoDrafts));
        }
        
        // Auto-download the content
        if (result.data?.downloads?.markdown) {
          const downloadResponse = await fetch(result.data.downloads.markdown);
          if (downloadResponse.ok) {
            const blob = await downloadResponse.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = result.data.downloads.filename || 'content.md';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }
        }
      } else {
        console.error('Generation failed:', result.error);
        alert(`Generation failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Generation error:', error);
      alert('Generation failed. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!user && !isDemoMode) {
      setShowAuthModal(true);
      return;
    }

    setUploadedFile(file);
    setUploadStatus('uploading');
    setUploadMessage('Uploading file...');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('workspace_id', isDemoMode ? 'demo-workspace' : user?.id || '');

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        setUploadStatus('success');
        setUploadMessage(`Successfully processed ${result.data.records_processed} content items`);
      } else {
        setUploadStatus('error');
        setUploadMessage(result.error || 'Upload failed');
      }
    } catch (error) {
      setUploadStatus('error');
      setUploadMessage('Upload failed. Please try again.');
    }
  };

  const contentTypes = [
    { value: 'blog', label: 'Blog Post', icon: <FileText className="h-4 w-4" /> },
    { value: 'infographic', label: 'Infographic', icon: <BarChart3 className="h-4 w-4" /> },
    { value: 'white_paper', label: 'White Paper', icon: <FileText className="h-4 w-4" /> },
    { value: 'social_post', label: 'Social Post', icon: <TrendingUp className="h-4 w-4" /> }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show demo mode or auth modal if no user
  if (!user && !isDemoMode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-gray-900 mb-2">
              AI SEO Content Agent
            </CardTitle>
            <CardDescription>
              Generate high-quality, SEO-optimized content with AI
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={enableDemoMode}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              <Play className="h-4 w-4 mr-2" />
              Try Demo Mode
            </Button>
            <div className="text-center text-sm text-gray-500">or</div>
            <Button 
              onClick={() => setShowAuthModal(true)}
              variant="outline"
              className="w-full"
            >
              <User className="h-4 w-4 mr-2" />
              Sign Up / Sign In
            </Button>
          </CardContent>
        </Card>
        
        {showAuthModal && (
          <AuthModal
            isOpen={showAuthModal}
            onClose={() => setShowAuthModal(false)}
            onSuccess={() => setShowAuthModal(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sparkles className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">AI SEO Content Agent</h1>
            </div>
            <div className="flex items-center space-x-4">
              {user ? (
                <>
                  <div className="flex items-center space-x-2">
                    <User className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-700">
                      {isDemoMode ? (
                        <span className="flex items-center">
                          <Badge variant="secondary" className="mr-2">Demo</Badge>
                          {user.name || user.email}
                        </span>
                      ) : (
                        user.name || user.email
                      )}
                    </span>
                  </div>
                  <Button variant="outline" onClick={handleSignOut}>
                    <LogOut className="h-4 w-4 mr-2" />
                    {isDemoMode ? 'Exit Demo' : 'Sign Out'}
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setShowAuthModal(true)}>
                    Sign In
                  </Button>
                  <Button onClick={() => setShowAuthModal(true)}>Get Started</Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {!user ? (
          // Welcome screen for non-authenticated users
          <div className="text-center py-20">
            <h2 className="text-5xl font-bold text-gray-900 mb-6">
              Generate SEO-Optimized Content with AI
            </h2>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Research, write, and optimize content automatically. Sign in to start creating 
              high-quality, SEO-optimized content in minutes.
            </p>
            <Button size="lg" onClick={() => setShowAuthModal(true)}>
              <Sparkles className="h-4 w-4 mr-2" />
              Get Started
            </Button>
          </div>
        ) : (
          // Main app for authenticated users
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Welcome back, {user.name || user.email}!
              </h2>
              <p className="text-gray-600">
                Ready to create some amazing content?
              </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="generate">Generate Content</TabsTrigger>
                <TabsTrigger value="upload">Upload Files</TabsTrigger>
                <TabsTrigger value="drafts">Past Drafts</TabsTrigger>
              </TabsList>

              <TabsContent value="generate" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Create New Content</CardTitle>
                    <CardDescription>
                      Generate SEO-optimized content with AI research and analysis
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                      {/* Content Planning Section */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
                          📝 Content Planning
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <Label htmlFor="topic">Topic Description *</Label>
                            <Textarea
                              id="topic"
                              placeholder="Describe what you want to write about in detail. For example: 'I want to write about how AI is transforming customer support in B2B SaaS companies, including the benefits, challenges, and real-world examples of companies that have successfully implemented AI solutions.'"
                              value={formData.topic}
                              onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                              rows={4}
                              required
                            />
                            <p className="text-sm text-gray-500">
                              Be specific about what you want to cover. This helps create better content.
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="content_purpose">Content Purpose *</Label>
                            <Select 
                              value={formData.content_purpose} 
                              onValueChange={(value) => setFormData({ ...formData, content_purpose: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="informational">📊 Informational (Share facts, data, insights)</SelectItem>
                                <SelectItem value="educational">🎓 Educational (Teach how to do something)</SelectItem>
                                <SelectItem value="persuasive">💡 Persuasive (Convince readers of a point)</SelectItem>
                                <SelectItem value="entertainment">🎭 Entertainment (Engage and entertain)</SelectItem>
                                <SelectItem value="market_analysis">📈 Market Analysis (Industry trends, competitive landscape)</SelectItem>
                                <SelectItem value="tutorial">🛠️ Tutorial (Step-by-step guide)</SelectItem>
                                <SelectItem value="case_study">📋 Case Study (Real-world examples)</SelectItem>
                                <SelectItem value="thought_leadership">💭 Thought Leadership (Expert insights and opinions)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="content_type">Content Format</Label>
                            <Select 
                              value={formData.content_type} 
                              onValueChange={(value) => setFormData({ ...formData, content_type: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {contentTypes.map((type) => (
                                  <SelectItem key={type.value} value={type.value}>
                                    <div className="flex items-center space-x-2">
                                      {type.icon}
                                      <span>{type.label}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="audience">Target Audience</Label>
                            <Input
                              id="audience"
                              placeholder="e.g., Marketing professionals, Small business owners"
                              value={formData.audience}
                              onChange={(e) => setFormData({ ...formData, audience: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>

                      {/* SEO Optimization Section */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
                          🔍 SEO Optimization
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <Label htmlFor="seo_keywords">SEO Keywords & Phrases</Label>
                            <Textarea
                              id="seo_keywords"
                              placeholder="Enter keywords and phrases you want to rank for. For example: 'AI customer support, B2B SaaS automation, customer service AI, help desk software'"
                              value={formData.seo_keywords}
                              onChange={(e) => setFormData({ ...formData, seo_keywords: e.target.value })}
                              rows={3}
                            />
                            <p className="text-sm text-gray-500">
                              Separate keywords with commas. These will be integrated naturally into your content.
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="tone">Content Tone</Label>
                            <Select 
                              value={formData.tone} 
                              onValueChange={(value) => setFormData({ ...formData, tone: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="professional">Professional</SelectItem>
                                <SelectItem value="casual">Casual</SelectItem>
                                <SelectItem value="friendly">Friendly</SelectItem>
                                <SelectItem value="authoritative">Authoritative</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      {/* Content Settings Section */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
                          ⚙️ Content Settings
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <Label htmlFor="word_count">Content Length (Words)</Label>
                            <Input
                              id="word_count"
                              type="number"
                              min="100"
                              value={formData.word_count}
                              onChange={(e) => setFormData({ ...formData, word_count: parseInt(e.target.value, 10) || 0 })}
                              placeholder="e.g., 500"
                              required
                            />
                            <p className="text-sm text-gray-500">
                              Content must be at least 100 words for optimal SEO.
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="due_date">Due Date (Optional)</Label>
                            <Input
                              id="due_date"
                              type="date"
                              value={formData.due_date}
                              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>

                      {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                          {error}
                        </div>
                      )}

                      <Button 
                        type="submit" 
                        className="w-full" 
                        disabled={isGenerating || !formData.topic || !formData.content_purpose || !formData.word_count}
                      >
                        {isGenerating ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                            Creating Content...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 mr-2" />
                            Create & Optimize Content
                          </>
                        )}
                      </Button>
                      
                      <div className="text-center text-sm text-gray-500">
                        <p>✨ Two-stage process: First we create content based on your topic, then optimize it with your SEO keywords</p>
                      </div>
                    </form>

                    {generationResult && (
                      <div className="mt-6 space-y-4">
                        {/* Success Banner */}
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-semibold text-green-800">Content Created & Optimized Successfully!</h4>
                              <p className="text-green-600 text-sm">
                                Your content has been created based on your topic and purpose, then optimized with your SEO keywords.
                              </p>
                            </div>
                            <Badge variant="default" className="bg-green-100 text-green-800">
                              SEO Score: {generationResult.data?.seo_score || 'N/A'}
                            </Badge>
                          </div>
                        </div>

                        {/* Generated Content Display */}
                        {generationResult.data?.draft && (
                          <Card className="border-2 border-blue-200">
                            <CardHeader className="bg-blue-50">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-blue-900">
                                  {generationResult.data.draft.title}
                                </CardTitle>
                                <div className="flex items-center space-x-2">
                                  <Badge variant="outline" className="text-blue-700">
                                    {generationResult.data.draft.word_count} words
                                  </Badge>
                                  <Badge variant="outline" className="text-blue-700">
                                    {generationResult.data.draft.reading_time} min read
                                  </Badge>
                                </div>
                              </div>
                              <CardDescription className="text-blue-700">
                                {typeof generationResult.data.draft.content === 'string' 
                                  ? '' 
                                  : generationResult.data.draft.content.meta_description || ''}
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="p-6">
                              {/* Content Preview */}
                              <div className="prose prose-sm max-w-none">
                                <div 
                                  className="whitespace-pre-wrap text-gray-800 leading-relaxed"
                                  style={{ 
                                    maxHeight: '300px', 
                                    overflow: 'hidden',
                                    position: 'relative'
                                  }}
                                >
                                  {typeof generationResult.data.draft.content === 'string' 
                                    ? generationResult.data.draft.content 
                                    : generationResult.data.draft.content.body}
                                  <div 
                                    className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent"
                                  />
                                </div>
                              </div>

                              {/* Content Metadata */}
                              <div className="mt-4 pt-4 border-t border-gray-200">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <span className="font-medium text-gray-700">Keywords:</span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {generationResult.data.draft.keywords?.map((keyword: string, index: number) => (
                                        <Badge key={index} variant="secondary" className="text-xs">
                                          {keyword}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                  <div>
                                    <span className="font-medium text-gray-700">Research Sources:</span>
                                    <p className="text-gray-600 mt-1">
                                      {generationResult.data.research_count || 0} sources analyzed
                                    </p>
                                  </div>
                                </div>
                              </div>

                              {/* Action Buttons */}
                              <div className="mt-4 flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      // Copy content to clipboard
                                      const contentBody = typeof generationResult.data.draft.content === 'string' 
                                        ? generationResult.data.draft.content 
                                        : generationResult.data.draft.content.body;
                                      navigator.clipboard.writeText(contentBody);
                                      alert('Content copied to clipboard!');
                                    }}
                                  >
                                    <FileText className="h-4 w-4 mr-1" />
                                    Copy Content
                                  </Button>
                                  
                                  {/* Download Buttons */}
                                  <DownloadButton
                                    draftId={generationResult.data.draft.id}
                                    filename={generationResult.data.downloads.filename}
                                    markdownUrl={generationResult.data.downloads.markdown}
                                    htmlUrl={generationResult.data.downloads.html}
                                    wordUrl={generationResult.data.downloads.word}
                                  />
                                </div>
                                <Badge variant="default" className="bg-blue-100 text-blue-800">
                                  SEO: {generationResult.data.draft.seo_score}/100
                                </Badge>
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="upload" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Upload Content Planning Files</CardTitle>
                    <CardDescription>
                      Upload CSV, Excel, or JSON files to batch process content requests
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center space-y-4">
                      <div className="p-8 border-2 border-dashed border-gray-300 rounded-lg">
                        <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          Upload Content Planning File
                        </h3>
                        <p className="text-gray-600 mb-4">
                          Upload a CSV, Excel, or JSON file with your content planning data
                        </p>
                        <div className="space-y-4">
                          <Button variant="outline" onClick={() => document.getElementById('file-upload')?.click()}>
                            <Upload className="h-4 w-4 mr-2" />
                            Choose File
                          </Button>
                          <input
                            id="file-upload"
                            type="file"
                            accept=".csv,.xlsx,.xls,.json"
                            className="hidden"
                            onChange={handleFileUpload}
                          />
                          <div className="text-sm text-gray-500">
                            Supported formats: CSV, Excel, JSON
                          </div>
                          
                          {uploadedFile && (
                            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <FileText className="h-4 w-4 text-gray-500" />
                                  <span className="text-sm font-medium">{uploadedFile.name}</span>
                                </div>
                                {uploadStatus === 'uploading' && (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                                )}
                                {uploadStatus === 'success' && (
                                  <Badge variant="default" className="bg-green-100 text-green-800">
                                    Success
                                  </Badge>
                                )}
                                {uploadStatus === 'error' && (
                                  <Badge variant="destructive">Error</Badge>
                                )}
                              </div>
                              {uploadMessage && (
                                <p className={`text-sm mt-2 ${
                                  uploadStatus === 'error' ? 'text-red-600' : 
                                  uploadStatus === 'success' ? 'text-green-600' : 
                                  'text-gray-600'
                                }`}>
                                  {uploadMessage}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="drafts" className="mt-6">
                <PastDrafts workspaceId={isDemoMode ? 'demo-workspace' : (user?.id || '')} />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {
          setShowAuthModal(false);
          // Refresh the page to update the UI
          window.location.reload();
        }}
      />
    </div>
  );
} 