import { useParams } from 'react-router-dom'
import { UserView } from '../components/UserView'

export function UserPage() {
  const { pubkey } = useParams<{ pubkey: string }>()

  if (!pubkey) {
    return <div>Invalid user</div>
  }

  return <UserView pubkey={pubkey} />
}
