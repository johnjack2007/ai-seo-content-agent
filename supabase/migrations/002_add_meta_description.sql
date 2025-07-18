-- Add meta_description column to content_drafts table
ALTER TABLE public.content_drafts 
ADD COLUMN meta_description TEXT;

-- Add index for meta_description searches
CREATE INDEX idx_content_drafts_meta_description ON public.content_drafts(meta_description); 