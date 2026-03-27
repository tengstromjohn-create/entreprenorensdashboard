import { supabase } from './supabase'

export async function callEdgeFunction<T>(
  functionName: string,
  body: Record<string, unknown>
): Promise<T> {
  const { data, error, response } = await supabase.functions.invoke(functionName, {
    body,
  })

  if (error) {
    // Extract useful info from the response if available
    let detail = error.message || 'Unknown error'
    if (response) {
      try {
        const text = typeof response.text === 'function'
          ? await response.text()
          : String(response)
        detail = `${response.status} — ${text}`
      } catch {
        detail = `${response.status ?? 'no status'} — ${detail}`
      }
    }
    console.error(`[callEdgeFunction] ${functionName} failed:`, detail)

    // If it's an auth/relay error, retry with anon key directly via fetch
    if (
      response?.status === 401 ||
      error.name === 'FunctionsRelayError' ||
      error.name === 'FunctionsFetchError'
    ) {
      console.warn(`[callEdgeFunction] Retrying ${functionName} with anon key fetch`)
      return fetchEdgeFunctionDirect<T>(functionName, body)
    }

    throw new Error(`Edge function ${functionName} failed: ${detail}`)
  }

  return data as T
}

async function fetchEdgeFunctionDirect<T>(
  functionName: string,
  body: Record<string, unknown>
): Promise<T> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  const resp = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${anonKey}`,
      'apikey': anonKey,
    },
    body: JSON.stringify(body),
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Edge function ${functionName} failed: ${resp.status} — ${text}`)
  }

  return resp.json() as Promise<T>
}
