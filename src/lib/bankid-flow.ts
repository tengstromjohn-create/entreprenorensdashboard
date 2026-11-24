export function requestBankIDLogin(redirect: (options: { acr_values: string; prompt: string }) => Promise<void>) {
  return redirect({ acr_values: 'idp:sbid', prompt: 'login' })
}

export async function signOutFromApp(
  removeBankIDUser: () => Promise<void>,
  signOut: () => Promise<{ error: unknown }>,
  showError: (message: string) => void,
) {
  try {
    await removeBankIDUser()
    const { error } = await signOut()
    if (error) throw error
  } catch {
    showError('Utloggningen misslyckades. Om du fortfarande är inloggad kan du försöka igen.')
  }
}

export async function handleBankIDRejection(
  response: Response | undefined,
  sessionId: string | null,
  rejectSession: (sessionId: string) => void,
): Promise<boolean> {
  if (response?.status !== 403 || !sessionId) return false
  const body = await response.json().catch(() => null)
  if (body?.code !== 'trust_level_required') return false
  rejectSession(sessionId)
  return true
}
