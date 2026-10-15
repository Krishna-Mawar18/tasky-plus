import type { Metadata } from 'next';
import Link from 'next/link';
import MarketingShell, { GetStartedButton } from '@/components/MarketingShell';
import {
  KanbanSquare,
  ClipboardList,
  Users,
  ShieldCheck,
  MessageSquare,
  Sparkles,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'About - Tasky',
  description:
    'Learn about Tasky, an app that helps individuals and teams organize tasks, projects and collaborative work with Kanban boards, roles, comments and Mark, an AI task assistant.',
};

const capabilities = [
  {
    icon: <KanbanSquare className="w-6 h-6 sm:w-8 sm:h-8 text-gray-600" />,
    title: 'Kanban Boards',
    desc: 'Visualize workflows with drag-and-drop task boards.',
  },
  {
    icon: <ClipboardList className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />,
    title: 'Task Organization',
    desc: 'Track titles, descriptions, priorities, due dates, tags and status.',
  },
  {
    icon: <Users className="w-6 h-6 sm:w-8 sm:h-8 text-pink-500" />,
    title: 'Team Collaboration',
    desc: 'Work together in shared workspaces and boards in real time.',
  },
  {
    icon: <ShieldCheck className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-500" />,
    title: 'Role-Based Permissions',
    desc: 'Owner, Manager and Viewer roles set the right level of access.',
  },
  {
    icon: <MessageSquare className="w-6 h-6 sm:w-8 sm:h-8 text-purple-500" />,
    title: 'Task Comments',
    desc: 'Discuss work in context with a comment thread on every task.',
  },
  {
    icon: <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-500" />,
    title: 'Mark, AI Task Assistant',
    desc: 'Manage workspaces, boards and tasks in natural language.',
  },
];

export default function AboutPage() {
  return (
    <MarketingShell>

      {/* Notebook lines background */}
      <div aria-hidden className="absolute inset-0 z-0 pointer-events-none">
        {[...Array(80)].map((_, i) => (
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
          {[...Array(40)].map((_, i) => (
            <div key={i} className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-gray-300 border border-gray-400 sm:border-2 mb-1 sm:mb-2" />
          ))}
        </div>
      </div>

    <div className="min-h-screen bg-transprent text-black relative overflow-x-hidden">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16 realtive z-10">
        <div className="text-center mb-10 sm:mb-14 animate-fadein">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold font-mono mb-4 text-gray-900">
            About Tasky
          </h1>
          <p className="text-base sm:text-lg text-gray-600 font-mono max-w-2xl mx-auto leading-relaxed">
            Tasky is a simple, beautiful way to manage tasks and collaborate with your
            team — from a single list to shared projects with the people you work with.
          </p>
        </div>

        <section className="bg-white/90 border border-gray-200 rounded-xl p-5 sm:p-8 shadow-lg mb-6 sm:mb-8 animate-fadein">
          <h2 className="font-mono font-bold text-lg sm:text-xl mb-3 text-gray-900">Our purpose</h2>
          <p className="text-gray-700 font-mono text-xs sm:text-sm leading-relaxed">
            Tasky exists to make organizing work feel effortless. It brings tasks, projects
            and the people working on them into one calm, focused place, so staying on top
            of what matters takes seconds rather than spreadsheets and scattered notes.
          </p>
        </section>

        <section className="bg-white/90 border border-gray-200 rounded-xl p-5 sm:p-8 shadow-lg mb-6 sm:mb-8 animate-fadein">
          <h2 className="font-mono font-bold text-lg sm:text-xl mb-3 text-gray-900">The problem it solves</h2>
          <p className="text-gray-700 font-mono text-xs sm:text-sm leading-relaxed">
            Work gets messy when tasks live in different tools and teammates cannot see
            what everyone else is doing. Tasky keeps it in one place: organize tasks into
            workspaces and boards, share them with your team, and keep every update in
            sync — so nothing important slips through the cracks.
          </p>
        </section>

        <section className="mb-6 sm:mb-8">
          <h2 className="font-mono font-bold text-lg sm:text-xl mb-4 text-gray-900 text-center">Core capabilities</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {capabilities.map((c) => (
              <div key={c.title} className="bg-white/90 border border-gray-200 rounded-xl p-4 sm:p-6 shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="mb-3 flex justify-center sm:justify-start">{c.icon}</div>
                <h3 className="font-mono font-bold text-base sm:text-lg mb-2 text-gray-900 text-center sm:text-left">{c.title}</h3>
                <p className="text-gray-700 font-mono text-xs sm:text-sm text-center sm:text-left leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white/90 border border-gray-200 rounded-xl p-5 sm:p-8 shadow-lg mb-8 sm:mb-10 animate-fadein">
          <h2 className="font-mono font-bold text-lg sm:text-xl mb-3 text-gray-900">How Mark fits in</h2>
          <p className="text-gray-700 font-mono text-xs sm:text-sm leading-relaxed">
            Mark is Tasky&apos;s built-in AI task assistant. Instead of clicking through
            screens, you can describe what you need in plain language — ask about your
            workspaces, boards and tasks, create a task, or retrieve the details of one.
            Mark asks a clarifying question when a request is unclear, stays within your
            own Tasky data, and asks for your approval before protected or destructive
            actions run. It is a focused assistant for Tasky, not an unrestricted agent.
          </p>
        </section>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <GetStartedButton>Get Started</GetStartedButton>
        </div>
      </div>
    </div>
    </MarketingShell>
  );
}
