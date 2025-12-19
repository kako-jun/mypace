import { useParams } from 'react-router-dom'
import { PostView } from '../components/PostView'
import { ErrorMessage } from '../components/ui'

export function PostPage() {
  const { id } = useParams<{ id: string }>()

  if (!id) {
    return <ErrorMessage variant="box">Post ID is required</ErrorMessage>
  }

  return <PostView eventId={id} />
}
