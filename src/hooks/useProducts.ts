import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { ProductAccess } from '@/types/dashboard'

export function useProducts(userId: string | undefined) {
  const [products, setProducts] = useState<ProductAccess[]>([])
  const [loading, setLoading] = useState(true)

  const fetchProducts = useCallback(async () => {
    if (!userId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('product_access')
        .select('product, source, expires_at')
        .eq('user_id', userId)
      if (error) throw error
      // Filtrera bort utgångna produkter i klienten
      const now = new Date().toISOString()
      const active = (data || []).filter(
        p => !p.expires_at || p.expires_at > now
      )
      setProducts(active.map(p => ({
        product: p.product,
        source: p.source || '',
        expires_at: p.expires_at,
        is_active: true,
      })))
    } catch (err) {
      console.error('Failed to fetch products:', err)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  const hasProduct = useCallback((productKey: string): boolean => {
    return products.some(p => p.product === productKey && p.is_active)
  }, [products])

  return { products, loading, hasProduct, refreshProducts: fetchProducts }
}
