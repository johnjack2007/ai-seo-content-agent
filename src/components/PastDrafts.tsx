'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Download, Edit, Save, X, RefreshCw } from 'lucide-react'
import { DownloadButton } from '@/components/DownloadButton'

interface ContentDraft {
  id: string
  title: string
  content: string | { body: string; meta_description?: string; keywords?: string[] }
  content_type: string
  topic: string
  created_at: string
  seo_score?: number
  keywords?: string[]
  word_count?: number
  reading_time?: number
}

interface PastDraftsProps {
  workspaceId: string
}

export function PastDrafts({ workspaceId }: PastDraftsProps) {
  const [drafts, setDrafts] = useState<ContentDraft[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchDrafts()
  }, [workspaceId])

  const fetchDrafts = async () => {
    try {
      setLoading(true)
      setError('')
      
      // For demo mode, use local storage
      if (workspaceId === 'demo-workspace') {
        const demoDrafts = localStorage.getItem('demo-drafts')
        if (demoDrafts) {
          setDrafts(JSON.parse(demoDrafts))
        } else {
          setDrafts([])
        }
        return
      }

      const response = await fetch(`/api/content/drafts?workspace_id=${workspaceId}`)
      if (response.ok) {
        const data = await response.json()
        setDrafts(data.drafts || [])
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to fetch drafts')
      }
    } catch (error) {
      console.error('Failed to fetch drafts:', error)
      setError('Failed to fetch drafts')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (draft: ContentDraft) => {
    setEditingId(draft.id)
    setEditTitle(draft.title)
    // Handle both string and object content formats
    const contentBody = typeof draft.content === 'string' ? draft.content : draft.content.body
    setEditContent(contentBody)
  }

  const handleSave = async (id: string) => {
    try {
      setSaving(true)
      setError('')

      const updatedDraft = {
        title: editTitle,
        content: {
          body: editContent,
          meta_description: typeof drafts.find(d => d.id === id)?.content === 'object' 
            ? (drafts.find(d => d.id === id)?.content as any)?.meta_description || ''
            : ''
        }
      }

      // For demo mode, update local storage
      if (workspaceId === 'demo-workspace') {
        const demoDrafts = JSON.parse(localStorage.getItem('demo-drafts') || '[]')
        const updatedDrafts = demoDrafts.map((draft: ContentDraft) => 
          draft.id === id ? { ...draft, ...updatedDraft } : draft
        )
        localStorage.setItem('demo-drafts', JSON.stringify(updatedDrafts))
        setDrafts(updatedDrafts)
        setEditingId(null)
        setEditContent('')
        setEditTitle('')
        return
      }

      const response = await fetch(`/api/content/drafts/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...updatedDraft,
          workspace_id: workspaceId
        }),
      })

      if (response.ok) {
        setEditingId(null)
        setEditContent('')
        setEditTitle('')
        // Refresh drafts
        fetchDrafts()
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to save draft')
      }
    } catch (error) {
      console.error('Error saving draft:', error)
      setError('Failed to save draft')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setEditingId(null)
    setEditContent('')
    setEditTitle('')
    setError('')
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this draft?')) {
      return
    }

    try {
      // For demo mode, remove from local storage
      if (workspaceId === 'demo-workspace') {
        const demoDrafts = JSON.parse(localStorage.getItem('demo-drafts') || '[]')
        const updatedDrafts = demoDrafts.filter((draft: ContentDraft) => draft.id !== id)
        localStorage.setItem('demo-drafts', JSON.stringify(updatedDrafts))
        setDrafts(updatedDrafts)
        return
      }

      // TODO: Implement delete API endpoint
      console.log('Delete functionality not yet implemented for non-demo mode')
    } catch (error) {
      console.error('Error deleting draft:', error)
      setError('Failed to delete draft')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getWordCount = (content: string | { body: string }) => {
    const text = typeof content === 'string' ? content : content.body
    return text.split(/\s+/).filter(word => word.length > 0).length
  }

  const getReadingTime = (content: string | { body: string }) => {
    const wordCount = getWordCount(content)
    return Math.ceil(wordCount / 200)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg">Loading drafts...</div>
      </div>
    )
  }

  if (drafts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Past Drafts</CardTitle>
          <CardDescription>
            Your generated content will appear here
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No drafts found. Generate some content to see it here!
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Past Drafts</h2>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{drafts.length} drafts</Badge>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchDrafts}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
      
      <div className="grid gap-4">
        {drafts.map((draft) => (
          <Card key={draft.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {editingId === draft.id ? (
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="text-lg font-semibold border border-gray-300 rounded px-2 py-1 w-full"
                    />
                  ) : (
                    <CardTitle className="text-lg">{draft.title}</CardTitle>
                  )}
                  <CardDescription>
                    {draft.topic} • {draft.content_type} • {formatDate(draft.created_at)}
                  </CardDescription>
                  <div className="flex gap-2 mt-2">
                    {draft.seo_score && (
                      <Badge variant="outline">
                        SEO Score: {draft.seo_score}/100
                      </Badge>
                    )}
                    <Badge variant="outline">
                      {getWordCount(draft.content)} words
                    </Badge>
                    <Badge variant="outline">
                      {getReadingTime(draft.content)} min read
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-2">
                  <DownloadButton
                    draftId={draft.id}
                    filename={draft.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}
                    markdownUrl={`/api/content/download/${draft.id}/markdown`}
                    htmlUrl={`/api/content/download/${draft.id}/html`}
                    wordUrl={`/api/content/download/${draft.id}/word`}
                  />
                  {editingId === draft.id ? (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleSave(draft.id)}
                        disabled={saving}
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancel}
                        disabled={saving}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(draft)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {editingId === draft.id ? (
                <div className="space-y-4">
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="min-h-[300px]"
                    placeholder="Edit your content here..."
                  />
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>{getWordCount({ body: editContent })} words</span>
                    <span>{getReadingTime({ body: editContent })} min read</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Content Preview with Expand/Collapse */}
                  <div className="prose max-w-none">
                    <div 
                      className="whitespace-pre-wrap text-gray-800 leading-relaxed"
                      style={{ 
                        maxHeight: '200px', 
                        overflowY: 'hidden',
                        border: '1px solid #e5e7eb',
                        padding: '1rem',
                        borderRadius: '0.5rem',
                        backgroundColor: '#f9fafb'
                      }}
                      id={`content-${draft.id}`}
                    >
                      {typeof draft.content === 'string' ? draft.content : draft.content.body}
                    </div>
                    {(typeof draft.content === 'string' ? draft.content : draft.content.body).length > 500 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => {
                          const contentDiv = document.getElementById(`content-${draft.id}`);
                          if (contentDiv) {
                            if (contentDiv.style.maxHeight === '200px') {
                              contentDiv.style.maxHeight = 'none';
                              contentDiv.style.overflowY = 'auto';
                            } else {
                              contentDiv.style.maxHeight = '200px';
                              contentDiv.style.overflowY = 'hidden';
                            }
                          }
                        }}
                      >
                        Show More
                      </Button>
                    )}
                  </div>
                </div>
              )}
              
              {draft.keywords && draft.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-4">
                  {draft.keywords.map((keyword, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {keyword}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
} 