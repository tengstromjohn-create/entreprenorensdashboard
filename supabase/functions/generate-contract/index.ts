import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getAdminClient } from '../_shared/supabase-admin.ts'
import { runQAPipeline, getFlaggedUserResponse } from '../_shared/qa-pipeline.ts'
import { generateWithGemini, GENERATION_MODEL } from '../_shared/llm.ts'
import { createContractHandler } from './handler.ts'

serve(createContractHandler({
  getAdmin: getAdminClient,
  isGenerationConfigured: () => Boolean(Deno.env.get('GEMINI_API_KEY')),
  generate: generateWithGemini,
  generationModel: GENERATION_MODEL,
  runQA: runQAPipeline,
  getFlaggedResponse: () => getFlaggedUserResponse('contract'),
}))
