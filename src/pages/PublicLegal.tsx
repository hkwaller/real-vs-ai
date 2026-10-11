import { publicPages } from '../../public-pages.mjs'
import Seo from '@/components/Seo'
export default function PublicLegal({ path }: { path: '/privacy' | '/terms' }) {
  return <><Seo title={path === '/privacy' ? 'Privacy - Real vs AI' : 'Terms - Real vs AI'} path={path} /><div dangerouslySetInnerHTML={{ __html: publicPages[path] }} /></>
}
