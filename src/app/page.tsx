'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { ListTodo, Zap, Palette, Shield, Smartphone, ArrowUpDown, PartyPopper } from 'lucide-react';

const features = [
  {
    icon: (
      <svg className="w-14 h-14 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeWidth={2} />
      </svg>
    ),
    title: 'Kanban Boards',
    desc: 'Visualize your workflow and move tasks with drag-and-drop.',
    cta: 'Try Boards',
  },
  {
    icon: (
      <svg className="w-14 h-14 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      </svg>
    ),
    title: 'Quick Add',
    desc: 'Add tasks and notes in seconds, from anywhere.',
    cta: 'Add Now',
  },
  {
    icon: (
      <svg className="w-14 h-14 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    title: 'Productivity Tips',
    desc: 'Get smart suggestions to work smarter, not harder.',
    cta: 'Get Tips',
  },
];





const tips = [
  'Use keyboard shortcuts to add tasks even faster!',
  'Try color-coding your lists for better focus.',
  'Invite a friend and get a productivity boost together!',
  'Set deadlines to stay on track with your goals.',
  'Break big projects into smaller, actionable tasks.',
  'Use labels or tags to categorize your tasks clearly.',
  'Pin your high-priority boards for quick access.',
  'Review your completed tasks weekly to track progress.',
  'Use the drag-and-drop feature to reorder tasks quickly.',
  'Assign tasks to teammates to delegate efficiently.',
  'Create daily goals to stay focused and consistent.',
  'Take short breaks to maintain mental clarity and energy.',
  'Use checklists inside tasks for step-by-step tracking.',
  'Customize your workspace to reflect your working style.',
  'Celebrate small wins to keep motivation high!',
];

const howItWorks = [
  { icon: <ListTodo className="w-12 h-12 text-gray-600" />, title: 'Add Tasks', desc: 'Quickly jot down what needs to get done.' },
  { icon: <ArrowUpDown className="w-12 h-12 text-green-500" />, title: 'Organize', desc: 'Drag and drop to prioritize and group.' },
  { icon: <PartyPopper className="w-12 h-12 text-purple-500" />, title: 'Complete', desc: 'Check off tasks and celebrate progress!' },
];

const faqs = [
  { q: 'Is Tasky free to use?', a: 'Yes! Tasky is free for individuals and small teams.' },
  { q: 'Can I use Tasky on mobile?', a: 'Absolutely. Tasky is fully responsive and works on any device.' },
  { q: 'How do I invite my team?', a: 'Just click “Invite” in your dashboard and send them a link.' },
  { q: 'Can I switch between multiple workspaces?', a: 'Yes! You can manage different projects in separate workspaces easily.' },
  { q: 'Do updates happen in real-time?', a: 'They sure do. Everyone sees changes instantly — no refresh needed.' },
  { q: 'Can I personalize my Tasky boards?', a: 'Yep! Use colors, labels, and emojis to make them your own.' },
  { q: 'How secure is Tasky?', a: 'Very. We use Firebase and best practices to keep your data safe and sound.' },
];

export default function HomePage() {
  const { user, loading, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [tipIdx, setTipIdx] = useState(0);
  const [faqOpen, setFaqOpen] = useState(-1);
  const [kanbanTasks, setKanbanTasks] = useState([
    { id: 1, text: 'Design landing page', done: false },
    { id: 2, text: 'Invite team', done: false },
    { id: 3, text: 'Try drag & drop', done: false },
    { id: 4, text: 'Create first workspace', done: false },
    { id: 5, text: 'Assign roles to team members', done: false },
  ]);
  
  const [showConfetti, setShowConfetti] = useState(false);
  const heroRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  // Rotate tips every 4s
  useEffect(() => {
    const interval = setInterval(() => setTipIdx((i) => (i + 1) % tips.length), 4000);
    return () => clearInterval(interval);
  }, []);
  // Confetti effect
  useEffect(() => {
    if (!showConfetti) return;
    const timeout = setTimeout(() => setShowConfetti(false), 1200);
    return () => clearTimeout(timeout);
  }, [showConfetti]);
  // Mouse parallax
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (!heroRef.current) return;
      const x = (e.clientX / window.innerWidth - 0.5) * 30;
      const y = (e.clientY / window.innerHeight - 0.5) * 30;
      heroRef.current.style.transform = `translate(${x}px, ${y}px)`;
    };
    window.addEventListener('mousemove', handle);
    return () => window.removeEventListener('mousemove', handle);
  }, []);
  // Scroll to top
  const [showTop, setShowTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 300);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f8f6] flex items-center justify-center">
        <div className="text-black text-xl font-mono">Loading...</div>
      </div>
    );
  }

  if (user) {
    return null; // Will redirect to dashboard
  }

  return (
    <div className="min-h-screen bg-[#f8f8f6] text-black relative overflow-x-hidden">
      {/* Animated background blobs */}
      <div className="absolute -top-16 -left-16 sm:-top-32 sm:-left-32 w-[200px] h-[200px] sm:w-[400px] sm:h-[400px] bg-gradient-to-br from-blue-200 via-pink-100 to-yellow-100 rounded-full blur-2xl sm:blur-3xl opacity-40 sm:opacity-60 animate-blob1 z-0" />
      <div className="absolute top-1/2 -right-8 sm:right-0 w-[150px] h-[150px] sm:w-[300px] sm:h-[300px] bg-gradient-to-br from-pink-200 via-blue-100 to-yellow-100 rounded-full blur-xl sm:blur-2xl opacity-30 sm:opacity-50 animate-blob2 z-0" />
      {/* Notebook lines background */}
      <div aria-hidden className="absolute inset-0 z-0 pointer-events-none">
        {[...Array(120)].map((_, i) => (
          <div
            key={i}
            className="w-full h-0.5 border-t border-dashed border-gray-200 opacity-40 sm:opacity-60 shadow-[0_1px_0_0_rgba(0,0,0,0.03)]"
            style={{ position: 'absolute', top: `${i * 1.8}rem` }}
          />
        ))}
      </div>
      {/* Notebook spiral */}
      <div className="hidden sm:block absolute left-0 top-0 h-full z-10">
        <div className="flex flex-col items-center h-full justify-center gap-4 sm:gap-6 pl-1 pr-2 sm:pl-2 sm:pr-4">
          {[...Array(80)].map((_, i) => (
            <div key={i} className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-gray-300 border border-gray-400 sm:border-2 mb-1 sm:mb-2 animate-spiral" style={{ animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>
      </div>


      {/* Navigation */}
      <nav className="border-b border-gray-300 bg-transparent relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 sm:h-20">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <Image src="/tasky_logo.svg" alt="Tasky Logo" width={48} height={48} className="w-8 h-8 sm:w-12 sm:h-12 transition-transform duration-300 hover:scale-110 hover:shadow-lg" />
              <span className="text-xl sm:text-2xl lg:text-3xl font-extrabold font-mono tracking-tight">Tasky</span>
            </div>
            <div className="flex items-center">
              <button
                onClick={signInWithGoogle}
                className="bg-black text-white px-3 py-2 sm:px-4 sm:py-2 rounded-lg font-mono font-bold text-sm sm:text-base lg:text-lg hover:bg-white hover:text-black hover:border-black border-2 border-black hover:scale-105 transition-all duration-200 shadow-md"
              >
                Sign In
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="flex flex-col items-center justify-center min-h-[60vh] sm:min-h-[70vh] px-4 sm:px-6 relative z-10 pt-8 sm:pt-12 pb-12 sm:pb-16 transition-transform duration-300">
        <div className="text-center max-w-5xl mx-auto animate-fadein">
          {/* Animated Geometric Logo */}
          <div className="flex justify-center mb-4 sm:mb-6">
            <div className="relative">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-black rounded-lg flex items-center justify-center text-white text-lg sm:text-2xl font-bold shadow-lg hover:scale-110 transition-transform duration-300 animate-bounce-slow">
                <span className="hidden sm:inline">Tasky</span>
                <span className="sm:hidden">T</span>
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 sm:w-8 sm:h-8 bg-blue-500 rounded-full animate-float"></div>
              <div className="absolute -bottom-1 -left-1 w-4 h-4 sm:w-5 sm:h-5 bg-pink-500 rounded-full animate-float-reverse"></div>
            </div>
          </div>

          {/* Main Title */}
          <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold font-mono mb-4 text-gray-900 leading-tight">
            <span className="block sm:inline">Organize tasks,</span>
            <br className="hidden sm:block" />
            <span className="block sm:inline mt-2 sm:mt-0">
              <span className="relative group">
                <span className="relative z-10">boost productivity</span>
                <span className="absolute -bottom-1 left-0 w-full h-1 sm:h-2 rounded-full bg-gradient-to-r from-[#48cae4] via-[#a2d2ff] to-[#48cae4] transform scale-x-0 group-hover:scale-x-100 transition-transform duration-1500 origin-left animate-fadein" style={{ animationDelay: '0.5s' }}></span>
              </span>
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg md:text-xl text-gray-600 font-mono mb-6 max-w-2xl mx-auto px-4 sm:px-0 leading-relaxed">
            The simple, beautiful way to manage your tasks and collaborate with your team.
          </p>

          {/* Random tip card */}
          <div className="bg-gray-100 text-gray-800 font-mono rounded-lg shadow px-3 py-2 sm:px-4 sm:py-2 mb-6 animate-fadein w-fit mx-auto text-xs sm:text-sm max-w-xs sm:max-w-none">
            <span className="font-bold">Tip:</span> <span className="break-words">{tips[tipIdx]}</span>
          </div>

          {/* Confetti on CTA */}
          {showConfetti && <div className="pointer-events-none fixed inset-0 z-50 animate-confetti" />}

          {/* Call-to-Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8 px-4 sm:px-0">
            <button
              onClick={() => {
                setShowConfetti(true);
                signInWithGoogle();
              }}
              className="bg-black text-white px-8 py-4 sm:px-10 sm:py-5 rounded-lg font-mono font-bold text-base sm:text-lg shadow-lg hover:bg-white hover:text-black hover:border-black border-2 border-black hover:scale-105 transition-all duration-200 w-full sm:w-auto"
            >
              Get Started Free
            </button>
          </div>
        </div>
      </div>
      
      {/* Features Section */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold font-mono text-center mb-8 sm:mb-12 px-4">Everything you need to stay organized</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {features.map((feature, index) => (
            <div key={feature.title} className="bg-white/90 border border-gray-200 rounded-xl p-4 sm:p-6 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 animate-fadein" style={{ animationDelay: `${0.2 + index * 0.1}s` }}>
              <div className="text-2xl sm:text-3xl mb-3 flex justify-center sm:justify-start">{feature.icon}</div>
              <h3 className="font-mono font-bold text-base sm:text-lg mb-2 text-gray-900 text-center sm:text-left">{feature.title}</h3>
              <p className="text-gray-700 font-mono text-xs sm:text-sm mb-4 text-center sm:text-left leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
        {/* Mini Kanban demo */}
        <div className="flex flex-col items-center mt-6 mb-6 px-4">
            <div className="bg-white/90 border border-gray-200 rounded-xl shadow-lg p-4 w-full max-w-sm sm:max-w-md">
              <div className="font-mono font-bold text-sm sm:text-base mb-2 text-center">Demo Board</div>
              <div className="flex flex-col gap-1">
                {kanbanTasks.map((t, i) => (
                  <div key={t.id} className={`flex items-center gap-2 px-2 py-1 rounded-md font-mono text-xs sm:text-sm transition-all duration-200 ${t.done ? 'bg-green-100 text-green-700 line-through' : 'bg-gray-100 hover:bg-gray-200 cursor-pointer'}`} onClick={() => setKanbanTasks(ts => ts.map((tt, idx) => idx === i ? { ...tt, done: !tt.done } : tt))}>
                    <span className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${t.done ? 'bg-green-400 border-green-600' : 'border-gray-400'}`}></span>
                    <span className="break-words">{t.text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="text-xs text-gray-400 mt-2 font-mono text-center">(Click a task to complete it!)</div>
          </div>
      </div>

      {/* Why Tasky Section */}
      <section className="relative z-5 max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold font-mono text-center mb-8 sm:mb-12 px-4">Why choose Tasky?</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
          <div className="bg-white/90 border border-gray-200 rounded-xl p-4 sm:p-6 shadow-lg hover:shadow-xl transition-all duration-300">
            <div className="mb-3 flex justify-center sm:justify-start">
              <Zap className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-500" />
            </div>
            <h3 className="font-mono font-bold text-base sm:text-lg mb-2 text-gray-900 text-center sm:text-left">Lightning Fast</h3>
            <p className="text-gray-700 font-mono text-xs sm:text-sm text-center sm:text-left leading-relaxed">Built for speed. Add, organize, and complete tasks in seconds.</p>
          </div>
          <div className="bg-white/90 border border-gray-200 rounded-xl p-4 sm:p-6 shadow-lg hover:shadow-xl transition-all duration-300">
            <div className="mb-3 flex justify-center sm:justify-start">
              <Palette className="w-6 h-6 sm:w-8 sm:h-8 text-pink-500" />
            </div>
            <h3 className="font-mono font-bold text-base sm:text-lg mb-2 text-gray-900 text-center sm:text-left">Beautiful Design</h3>
            <p className="text-gray-700 font-mono text-xs sm:text-sm text-center sm:text-left leading-relaxed">Clean, intuitive interface that makes task management enjoyable.</p>
          </div>
          <div className="bg-white/90 border border-gray-200 rounded-xl p-4 sm:p-6 shadow-lg hover:shadow-xl transition-all duration-300">
            <div className="mb-3 flex justify-center sm:justify-start">
              <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-green-500" />
            </div>
            <h3 className="font-mono font-bold text-base sm:text-lg mb-2 text-gray-900 text-center sm:text-left">Secure & Private</h3>
            <p className="text-gray-700 font-mono text-xs sm:text-sm text-center sm:text-left leading-relaxed">Your data is encrypted and secure. We never share your information.</p>
          </div>
          <div className="bg-white/90 border border-gray-200 rounded-xl p-4 sm:p-6 shadow-lg hover:shadow-xl transition-all duration-300">
            <div className="mb-3 flex justify-center sm:justify-start">
              <Smartphone className="w-6 h-6 sm:w-8 sm:h-8 text-gray-600" />
            </div>
            <h3 className="font-mono font-bold text-base sm:text-lg mb-2 text-gray-900 text-center sm:text-left">Works Everywhere</h3>
            <p className="text-gray-700 font-mono text-xs sm:text-sm text-center sm:text-left leading-relaxed">Access your tasks on any device, anywhere, anytime.</p>
          </div>
        </div>
      </section>

      {/* How it works steps */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
          {howItWorks.map((h, i) => (
            <div key={h.title} className="bg-white/90 border-2 border-gray-200 rounded-2xl p-4 sm:p-6 flex flex-col items-center text-center shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 animate-fadein" style={{ animationDelay: `${0.3 + i * 0.1}s` }}>
              <div className="text-3xl sm:text-4xl mb-3">{h.icon}</div>
              <h3 className="font-mono font-bold text-base sm:text-lg mb-2 text-gray-900">{h.title}</h3>
              <p className="text-gray-700 font-mono text-xs sm:text-sm leading-relaxed">{h.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ accordion */}
      <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold font-mono text-center mb-6 sm:mb-8">FAQ</h2>
        <div className="flex flex-col gap-3 sm:gap-4">
          {faqs.map((f, i) => (
            <div key={f.q} className="bg-white/90 border border-gray-200 rounded-lg shadow p-4 sm:p-5 font-mono cursor-pointer hover:shadow-md transition-all duration-200" onClick={() => setFaqOpen(faqOpen === i ? -1 : i)}>
              <div className="flex items-center justify-between text-sm sm:text-base font-bold">
                <span className="pr-4 leading-relaxed">{f.q}</span>
                <span className={`transition-transform duration-200 flex-shrink-0 ${faqOpen === i ? 'rotate-90' : ''}`}>▶</span>
              </div>
              <div className={`overflow-hidden transition-all duration-300 ${faqOpen === i ? 'max-h-40 mt-2 sm:mt-3' : 'max-h-0'}`}>
                {faqOpen === i && <div className="text-gray-700 text-xs sm:text-sm mt-2 leading-relaxed">{f.a}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 bg-white/90 border-t border-gray-200 mt-12 sm:mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="flex items-center mb-3 sm:mb-4">
                <Image src="/tasky_logo.svg" alt="Tasky Logo" width={32} height={32} className="w-6 h-6 sm:w-8 sm:h-8 mr-2" />
                <span className="font-mono font-bold text-base sm:text-lg">Tasky</span>
              </div>
              <p className="text-gray-600 font-mono text-xs sm:text-sm mb-3 sm:mb-4 leading-relaxed">
                The simple, beautiful way to manage tasks and collaborate with your team.
                <br />
                Special thanks Khatu Shyamji 🚀
              </p>
              <div className="flex space-x-4">
                <a href="https://github.com/Darktasky18" className="text-gray-400 hover:text-gray-600 transition-colors">
                  <span className="sr-only">GitHub</span>
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                </a>
                <a href="https://www.instagram.com/krishna.mawar18" className="text-gray-400 hover:text-gray-600 transition-colors">
                  <span className="sr-only">Instagram</span>
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                </a>
                <a href="https://discord.gg/HSgqaBYP" className="text-gray-400 hover:text-gray-600 transition-colors">
                  <span className="sr-only">Discord</span>
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419-.019 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1568 2.4189Z"/>
                  </svg>
                </a>
              </div>
            </div>
            <div>
              <h3 className="font-mono font-bold text-xs sm:text-sm text-gray-900 mb-2 sm:mb-3">Product</h3>
              <ul className="space-y-1 sm:space-y-2">
                <li><a href="#" className="text-gray-600 font-mono text-xs sm:text-sm hover:text-gray-900 transition-colors">Features</a></li>
                <li><a href="#" className="text-gray-600 font-mono text-xs sm:text-sm hover:text-gray-900 transition-colors">Pricing</a></li>
                <li><a href="#" className="text-gray-600 font-mono text-xs sm:text-sm hover:text-gray-900 transition-colors">API</a></li>
                <li><a href="#" className="text-gray-600 font-mono text-xs sm:text-sm hover:text-gray-900 transition-colors">Integrations</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-mono font-bold text-xs sm:text-sm text-gray-900 mb-2 sm:mb-3">Company</h3>
              <ul className="space-y-1 sm:space-y-2">
                <li><a href="#" className="text-gray-600 font-mono text-xs sm:text-sm hover:text-gray-900 transition-colors">About</a></li>
                <li><a href="#" className="text-gray-600 font-mono text-xs sm:text-sm hover:text-gray-900 transition-colors">Blog</a></li>
                <li><a href="#" className="text-gray-600 font-mono text-xs sm:text-sm hover:text-gray-900 transition-colors">Careers</a></li>
                <li><a href="#" className="text-gray-600 font-mono text-xs sm:text-sm hover:text-gray-900 transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-mono font-bold text-xs sm:text-sm text-gray-900 mb-2 sm:mb-3">Feedback</h3>
              <p className="text-gray-600 font-mono text-xs sm:text-sm mb-2 sm:mb-3 leading-relaxed">Have suggestions or found a bug? Let us know!</p>
              <form 
                action="https://formspree.io/f/mjkoebzy" 
                method="POST"
                className="space-y-2 sm:space-y-3"
              >
                <input 
                  type="email" 
                  name="email" 
                  placeholder="your_email@gmail.com"
                  required
                  className="w-full px-2 py-2 sm:px-3 sm:py-2 border border-gray-300 rounded-lg font-mono text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" 
                />
                <textarea 
                  name="message" 
                  placeholder="Your feedback here..." 
                  required
                  rows={3}
                  className="w-full px-2 py-2 sm:px-3 sm:py-2 border border-gray-300 rounded-lg font-mono text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 resize-none" 
                />
                <button 
                  type="submit"
                  className="w-full bg-black text-white px-3 py-2 sm:px-4 sm:py-2 rounded-lg font-mono text-xs sm:text-sm font-bold hover:bg-gray-800 transition-colors"
                >
                  Send Feedback
                </button>
              </form>
            </div>
          </div>
          <div className="border-t border-gray-200 mt-6 sm:mt-8 pt-4 sm:pt-6 text-center">
            <p className="text-gray-500 font-mono text-xs sm:text-sm">
              © 2025 Tasky. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* Scroll to top button */}
      {showTop && (
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 bg-black text-white w-10 h-10 sm:w-12 sm:h-12 rounded-full shadow-lg hover:bg-[#abc4ff] hover:scale-105 hover:text-black transition-colors animate-pop flex items-center justify-center text-lg sm:text-2xl font-bold">
          ↑
        </button>
      )}
      
      {/* Animations */}
      <style jsx global>{`
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
        @keyframes fadein { from { opacity: 0; } to { opacity: 1; } }
        .animate-fadein { animation: fadein 1s ease; }
        .animate-fadein.delay-200 { animation-delay: 0.2s; }
        .animate-fadein.delay-100 { animation-delay: 0.1s; }
        @keyframes slidein { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
        .animate-slidein { animation: slidein 0.8s cubic-bezier(.4,0,.2,1) both; }
        .animate-slidein.delay-100 { animation-delay: 0.1s; }
        @keyframes pop { 0% { transform: scale(0.8); opacity: 0; } 80% { transform: scale(1.05); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
        .animate-pop { animation: pop 0.7s cubic-bezier(.4,0,.2,1) both; }
        @keyframes bounce-slow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        .animate-bounce-slow { animation: bounce-slow 2.5s infinite; }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(6px); } }
        .animate-float { animation: float 3s infinite; }
        @keyframes float-reverse { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        .animate-float-reverse { animation: float-reverse 3s infinite; }
        @keyframes sticky-wiggle { 0%, 100% { transform: rotate(1deg) scale(1); } 20% { transform: rotate(-1deg) scale(1.02); } 40% { transform: rotate(1.5deg) scale(1.01); } 60% { transform: rotate(-0.5deg) scale(1.02); } 80% { transform: rotate(1deg) scale(1.005); } }
        .animate-sticky-wiggle { animation: sticky-wiggle 4s infinite; }
        @keyframes spiral { 0% { box-shadow: 0 0 0 0 #bbb; } 50% { box-shadow: 0 0 4px 1px #bbb; } 100% { box-shadow: 0 0 0 0 #bbb; } }
        .animate-spiral { animation: spiral 2.5s infinite; }
        @keyframes bounce-arrow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(16px); } }
        .animate-bounce-arrow { animation: bounce-arrow 1.5s infinite; }
        @keyframes blob1 { 0%,100%{transform:scale(1) translateY(0);} 50%{transform:scale(1.05) translateY(10px);} }
        .animate-blob1 { animation: blob1 8s ease-in-out infinite; }
        @keyframes blob2 { 0%,100%{transform:scale(1) translateY(0);} 50%{transform:scale(1.03) translateY(-10px);} }
        .animate-blob2 { animation: blob2 10s ease-in-out infinite; }
        @keyframes confetti { 0%{opacity:1;} 100%{opacity:0;transform:translateY(100vh);} }
        .animate-confetti:before, .animate-confetti:after { content:''; position:fixed; left:0; top:0; width:100vw; height:100vh; pointer-events:none; z-index:9999; }
        .animate-confetti:before { background: repeating-linear-gradient(120deg, #fbbf24 0 2px, transparent 2px 8px), repeating-linear-gradient(60deg, #3b82f6 0 2px, transparent 2px 8px), repeating-linear-gradient(240deg, #ec4899 0 2px, transparent 2px 8px); opacity:0.5; animation: confetti 1.2s linear; }
        .animate-confetti:after { background: repeating-linear-gradient(90deg, #fbbf24 0 2px, transparent 2px 8px), repeating-linear-gradient(180deg, #3b82f6 0 2px, transparent 2px 8px), repeating-linear-gradient(270deg, #ec4899 0 2px, transparent 2px 8px); opacity:0.5; animation: confetti 1.2s linear; }
        
        /* Mobile-specific optimizations */
        @media (max-width: 640px) {
          .animate-bounce-slow { animation: bounce-slow 3s infinite; }
          .animate-float { animation: float 4s infinite; }
          .animate-float-reverse { animation: float-reverse 4s infinite; }
          .animate-blob1 { animation: blob1 10s ease-in-out infinite; }
          .animate-blob2 { animation: blob2 12s ease-in-out infinite; }
        }
      `}</style>
    </div>
  );
}
