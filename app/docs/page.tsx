import DocsClient from './DocsClient';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export default function DocsPage() {
  return <DocsClient />;
}
