import { useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { nip19 } from 'nostr-tools'
import { Loading } from '../components/ui'

/**
 * Nostr URI ハンドラーページ
 * web+nostr: プロトコルを処理し、適切なページにリダイレクト
 *
 * 対応形式:
 * - nostr:note1... → /post/:id
 * - nostr:nevent1... → /post/:id
 * - nostr:npub1... → /user/:pubkey
 * - nostr:nprofile1... → /user/:pubkey
 */
export function NostrPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    const uri = searchParams.get('uri')
    if (!uri) {
      navigate('/', { replace: true })
      return
    }

    // web+nostr: または nostr: プレフィックスを除去
    const cleaned = uri.replace(/^(web\+)?nostr:/, '')

    try {
      const decoded = nip19.decode(cleaned)

      switch (decoded.type) {
        case 'note': {
          // note1... → hex event ID
          navigate(`/post/${decoded.data}`, { replace: true })
          break
        }
        case 'nevent': {
          // nevent1... → { id, relays?, author?, kind? }
          const eventData = decoded.data as { id: string }
          navigate(`/post/${eventData.id}`, { replace: true })
          break
        }
        case 'npub': {
          // npub1... → hex pubkey
          navigate(`/user/${decoded.data}`, { replace: true })
          break
        }
        case 'nprofile': {
          // nprofile1... → { pubkey, relays? }
          const profileData = decoded.data as { pubkey: string }
          navigate(`/user/${profileData.pubkey}`, { replace: true })
          break
        }
        default:
          // 未知の形式はホームへ
          console.warn('Unknown nostr URI type:', decoded.type)
          navigate('/', { replace: true })
      }
    } catch (err) {
      console.error('Failed to decode nostr URI:', err)
      navigate('/', { replace: true })
    }
  }, [searchParams, navigate])

  return <Loading />
}
