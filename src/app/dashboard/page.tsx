import Link from "next/link";
import MarkdownEditor from '@/components/MarkdownEditor';

export default function Dashboard() {
  return (
    <main className="flex min-h-screen flex-col">
      <div className="flex-1">
        <MarkdownEditor />
      </div>
    </main>
  );
} 