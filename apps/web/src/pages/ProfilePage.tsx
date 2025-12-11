import { useParams } from 'react-router-dom'
import { UserView } from '../components/UserView'

export function ProfilePage() {
  const { pubkey } = useParams<{ pubkey: string }>()

  if (!pubkey) {
    return <div>Invalid profile</div>
  }

  return <UserView pubkey={pubkey} />
}
