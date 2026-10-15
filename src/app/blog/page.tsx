import type { Metadata } from 'next';
import Link from 'next/link';
import MarketingShell, { GetStartedButton }  from '@/components/MarketingShell';
import { KanbanSquare, Users, Sparkles, ShieldCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Blog - Tasky',
  description:
    'Guides and resources on organizing work with Kanban boards, team task management, role-based access, and using Mark, the Tasky AI task assistant.',
};

const topics = [
  {
    icon: <KanbanSquare className="w-6 h-6 sm:w-8 sm:h-8 text-gray-600" />,
    title: 'How to Organize Work with Kanban Boards',
    summary:
      'A gentle introduction to columns, cards and drag-and-drop, and how to shape a board that matches the way your team actually works.',
  },
  {
    icon: <Users className="w-6 h-6 sm:w-8 sm:h-8 text-pink-500" />,
    title: 'A Practical Guide to Team Task Management',
    summary:
      'How shared workspaces and boards keep everyone aligned, and simple habits for assigning, tracking and finishing work together.',
  },
  {
    icon: <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-500" />,
    title: 'Using AI to Manage Tasks with Mark',
    summary:
      'What you can ask Mark, how it turns natural language into task actions, and how its approval step keeps sensitive changes under your control.',
  },
  {
    icon: <ShieldCheck className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-500" />,
    title: 'Understanding Owner, Manager and Viewer Roles',
    summary:
      'A plain-language look at what each role can do, so you can give teammates exactly the access they need — no more, no less.',
  },
];

export default function BlogPage() {
  return (
    <MarketingShell>

      {/* Notebook lines background */}
      <div aria-hidden className="absolute inset-0 z-0 pointer-events-none">
        {[...Array(36)].map((_, i) => (
          <div
            key={i}
            className="w-full h-0.5 border-t border-dashed border-gray-200 opacity-40 sm:opacity-60 shadow-[0_1px_0_0_rgba(0,0,0,0.03)]"
            style={{ position: 'absolute', top: `${i * 1.8}rem` }}
          />
        ))}
      </div>

      {/* Notebook spiral */}
      <div className="hidden sm:block absolute left-0 top-10 h-full z-10">
        <div className="flex flex-col items-center h-full justify-top gap-4 sm:gap-6 pl-0 pr-2 sm:pl-2 sm:pr-4">
          {[...Array(22)].map((_, i) => (
            <div key={i} className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-gray-300 border border-gray-400 sm:border-2 mb-1 sm:mb-2" />
          ))}
        </div>
      </div>

      <div className="min-h-screen text-black relative overflow-x-hidden">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="text-center mb-10 sm:mb-14 animate-fadein">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold font-mono mb-4 text-gray-900">
            Tasky Blog
          </h1>
          <p className="text-base sm:text-lg text-gray-600 font-mono max-w-2xl mx-auto leading-relaxed">
            Practical guides on getting organized, working with your team, and making the
            most of Tasky. These topics are being written — here is what is coming.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {topics.map((topic) => (
            <article
              key={topic.title}
              className="bg-white/90 border border-gray-200 rounded-xl p-4 sm:p-6 shadow-lg transition-all duration-300 flex flex-col"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex justify-center sm:justify-start">{topic.icon}</div>
                <span className="font-mono text-[10px] sm:text-xs font-bold uppercase tracking-wide text-gray-500 bg-gray-100 border border-gray-200 rounded-full px-2 py-1">
                  Coming soon
                </span>
              </div>
              <h2 className="font-mono font-bold text-base sm:text-lg mb-2 text-gray-900">{topic.title}</h2>
              <p className="text-gray-700 font-mono text-xs sm:text-sm leading-relaxed">{topic.summary}</p>
            </article>
          ))}
        </div>
        <div className="mt-8 sm:mt-10 text-center">
          <GetStartedButton>Get Started</GetStartedButton>
        </div>
      </div>
    </div>
    </MarketingShell>
  );
}
