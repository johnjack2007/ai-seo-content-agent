# AI SEO Content Agent

A sophisticated AI-powered content generation platform that creates SEO-optimized blog posts using advanced prompt chaining and multi-agent architecture.

## 🚀 Features

- **Multi-Agent Pipeline**: Specialized AI agents for research, content generation, humanization, and SEO optimization
- **Intelligent Research**: Real-time web research with SerpAPI + OpenAI fallback system
- **Advanced Prompt Chaining**: Role-based prompts with temperature control for optimal content quality
- **SEO Optimization**: Automatic keyword optimization, meta description generation, and SEO scoring
- **Content Humanization**: AI content that sounds natural and engaging
- **Multi-Format Export**: Markdown, Word documents, HTML, and plain text
- **Quality Control**: Word count enforcement, retry logic, and quality scoring
- **Caching System**: Intelligent caching for research and content optimization

## 🏗️ Architecture

### Multi-Agent Pipeline
```
User Input → Validation → Research → Content Generation → Humanization → SEO Optimization → Export
```

### Core Agents
- **IntentClassifierAgent**: Determines user intent and content purpose
- **TopicSanitizerAgent**: Safety filtering and content moderation
- **ResearchAgent**: Web research with intelligent fallback system
- **GenerationAgent**: Multi-stage content creation with outline generation
- **HumanizerAgent**: Makes AI content sound more natural
- **SEOOptimizationAgent**: Keyword optimization and SEO scoring

### Technical Stack
- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API routes
- **Database**: Supabase (PostgreSQL)
- **AI**: OpenAI GPT-4
- **Research**: SerpAPI + OpenAI fallback
- **Deployment**: Vercel

## 🛠️ Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn
- OpenAI API key
- SerpAPI key (optional, has fallback)
- Supabase account (optional, has local storage fallback)

### Setup
```bash
# Clone the repository
git clone https://github.com/yourusername/ai-seo-content-agent.git
cd ai-seo-content-agent

# Install dependencies
npm install

# Set up environment variables
cp env.example .env.local
```

### Environment Variables
```bash
# Required
OPENAI_API_KEY=your_openai_api_key

# Optional (with fallbacks)
SERPAPI_KEY=your_serpapi_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### Development
```bash
# Start development server
npm run dev

# Open http://localhost:3000
```

## 🎯 Usage

### Web Interface
1. Open the application in your browser
2. Click "Try Demo Mode" for immediate testing
3. Enter your topic, content purpose, and SEO keywords
4. Generate high-quality, SEO-optimized content

### API Usage
```bash
curl -X POST http://localhost:3000/api/content/generate \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "AI in marketing automation",
    "content_purpose": "informational",
    "content_type": "blog",
    "audience": "marketing professionals",
    "tone": "professional",
    "seo_keywords": ["AI marketing", "automation"],
    "workspace_id": "demo-workspace",
    "word_count": 500
  }'
```

## 🔧 Advanced Features

### Research System
- **Primary**: SerpAPI web search for real-time data
- **Fallback**: OpenAI-powered contextual research
- **Tertiary**: Basic template research as ultimate backup

### Content Quality
- **Word Count Enforcement**: Retry logic to meet target word counts
- **SEO Scoring**: 0-100 scale with optimization recommendations
- **Content Validation**: Safety checks and quality control

### Performance
- **Parallel Processing**: 12 concurrent research queries
- **Intelligent Caching**: 24-hour cache for repeated topics
- **Streaming Responses**: Real-time feedback for large content

## 📊 Prompt Engineering

### Role-Based Prompts
Each agent has specialized roles:
- **Research Analyst**: Data gathering and analysis
- **Content Strategist**: Structure and planning
- **Professional Writer**: Content creation
- **SEO Specialist**: Optimization and ranking

### Temperature Control
- **0.3**: Outline generation (structured, consistent)
- **0.4**: Content creation (balanced creativity)
- **0.7**: Humanization (more creative, natural)

## 🚀 Deployment

### Vercel Deployment
1. Push your code to GitHub
2. Connect your repository to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy automatically on every push

### Environment Variables for Production
Set these in your Vercel dashboard:
- `OPENAI_API_KEY`
- `SERPAPI_KEY` (optional)
- `NEXT_PUBLIC_SUPABASE_URL` (optional)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (optional)
- `SUPABASE_SERVICE_ROLE_KEY` (optional)

## 🔍 API Reference

### Content Generation
**POST** `/api/content/generate`

**Request Body:**
```json
{
  "topic": "string",
  "content_purpose": "informational|educational|persuasive",
  "content_type": "blog|article|guide",
  "audience": "string",
  "tone": "professional|casual|friendly",
  "seo_keywords": ["string"],
  "workspace_id": "string",
  "word_count": number
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "draft": {
      "id": "string",
      "title": "string",
      "content": "string",
      "meta_description": "string"
    },
    "research_count": number,
    "research_quality": "real-time|fallback",
    "seo_score": number,
    "word_count": number,
    "reading_time": number,
    "humanized": boolean
  }
}
```

### Download Content
**GET** `/api/content/download/[id]/[format]`

Formats: `markdown`, `word`, `html`, `text`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- OpenAI for GPT-4 API
- SerpAPI for web research capabilities
- Next.js team for the amazing framework
- Vercel for seamless deployment

## 📞 Support

For support, email support@example.com or create an issue in this repository.

---

**Built with ❤️ using Next.js, OpenAI, and advanced AI prompt engineering** 