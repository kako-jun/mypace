import { useParams } from 'react-router-dom'
import { PostView } from '../components/PostView'

export function PostPage() {
  const { id } = useParams<{ id: string }>()

  if (!id) {
    return <div className="error-box">Post ID is required</div>
  }

  return <PostView eventId={id} />
}
