import { supabase } from './supabase'

export async function callEdgeFunction<T>(
  functionName: string,
  body: Record<string, unknown>
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(functionName, {
    body,
  })
  if (error) throw new Error(`Edge function ${functionName} failed: ${error.message}`)
  return data as T
}
