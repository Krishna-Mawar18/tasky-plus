'use client';

import type { Metadata } from 'next';
import Link from 'next/link';
import MarketingShell, { GetStartedButton }  from '@/components/MarketingShell';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';


export default function ContactPage() {
  const { signInWithGoogle } = useAuth();

  const metadata: Metadata = {
  title: 'Contact - Tasky',
  description:
    'Get in touch with the Tasky team. Send a question, suggestion or bug report through the contact form, or browse the FAQ for common questions.',
  };

  return (
    <div className="min-h-screen bg-[#f8f8f6] text-black relative overflow-x-hidden">
      {/* Navigation */}
      <nav className="border-b border-gray-300 bg-[#f8f8f6] relative z-10">
        <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 sm:h-20">
            <Link href="/" className="flex items-center space-x-2 sm:space-x-3">
              <Image src="/tasky.svg" alt="Tasky Logo" width={48} height={48} className="w-8 h-8 sm:w-12 sm:h-12 transition-transform rounded-xl duration-300 hover:scale-110 hover:shadow-lg" />
              <span className="text-xl sm:text-2xl lg:text-3xl font-extrabold font-mono tracking-tight">Tasky</span>
            </Link>
            <div className="flex items-center gap-3 sm:gap-6">
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

      {/* Notebook lines background */}
      <div aria-hidden className="absolute inset-0 z-0 pointer-events-none">
        {[...Array(40)].map((_, i) => (
          <div
            key={i}
            className="w-full h-0.5 border-t border-dashed border-gray-200 opacity-40 sm:opacity-60 shadow-[0_1px_0_0_rgba(0,0,0,0.03)]"
            style={{ position: 'absolute', top: `${i * 1.8}rem` }}
          />
        ))}
      </div>

      {/* Notebook spiral */}
      <div className="hidden sm:block absolute left-0 top-0 h-full z-10">
        <div className="flex flex-col items-center h-full justify-center gap-4 sm:gap-6 pl-0 pr-2 sm:pl-2 sm:pr-4">
          {[...Array(28)].map((_, i) => (
            <div key={i} className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-gray-300 border border-gray-400 sm:border-2 mb-1 sm:mb-2" />
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-10 relative z-10">
        <div className="text-center mb-8 sm:mb-10 animate-fadein">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold font-mono mb-4 text-gray-900">
            Contact Tasky
          </h1>
          <p className="text-base sm:text-lg text-gray-600 font-mono max-w-xl mx-auto leading-relaxed">
            Have a question, a suggestion, or found a bug? Send a message and we will
            take a look.
          </p>
        </div>

        <div className="bg-white/90 border border-gray-200 rounded-xl p-5 sm:p-8 shadow-lg animate-fadein">
          <form action="https://formspree.io/f/mjkoebzy" method="POST" className="space-y-4">
            <div>
              <label htmlFor="email" className="block font-mono font-bold text-xs sm:text-sm text-gray-900 mb-2">
                Your email
              </label>
              <input
                id="email"
                type="email"
                name="email"
                placeholder="your_email@gmail.com"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
            </div>
            <div>
              <label htmlFor="message" className="block font-mono font-bold text-xs sm:text-sm text-gray-900 mb-2">
                Message
              </label>
              <textarea
                id="message"
                name="message"
                placeholder="How can we help?"
                required
                rows={5}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 resize-none"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-black text-white px-4 py-3 rounded-lg font-mono text-sm sm:text-base font-bold hover:bg-white hover:text-black hover:border-black border-2 border-black transition-all duration-200"
            >
              Send Message
            </button>
          </form>
        </div>

        <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 text-center">
          <GetStartedButton>Get Started</GetStartedButton>
        </div>
      </div>
      {/* Footer */}
            <footer className="relative z-10 bg-white/90 border-t border-gray-200 mt-12 sm:mt-16">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
                  <div className="sm:col-span-2 lg:col-span-4">
                    <div className="flex items-center mb-3 sm:mb-4">
                      <Image src="/tasky.svg" alt="Tasky Logo" width={48} height={48} className="w-8 h-8 sm:w-8 sm:h-8 mr-2 rounded-lg" />
                      <span className="font-mono font-bold text-base sm:text-lg">Tasky</span>
                    </div>
                    <p className="text-gray-600 font-mono text-xs sm:text-sm mb-3 sm:mb-4 leading-relaxed">
                      The simple, beautiful way to manage tasks and collaborate with your team.
                      <br />
                      Special thanks Khatu Shyamji 🚀
                    </p>
                    <div className="flex space-x-4">
                      <a href="https://github.com/Krishna-Mawar18" className="text-gray-400 hover:text-gray-600 transition-colors">
                        <span className="sr-only">GitHub</span>
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                        </svg>
                      </a>
                      <a href="https://www.instagram.com/krishnamawar_" className="text-gray-400 hover:text-gray-600 transition-colors">
                        <span className="sr-only">Instagram</span>
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                        </svg>
                      </a>
                      <a href="https://www.linkedin.com/in/krishnamawar" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600 transition-colors">
                        <span className="sr-only">LinkedIn</span>
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                        </svg>
                      </a>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-mono font-bold text-xs sm:text-sm text-gray-900 mb-2 sm:mb-3">Product</h3>
                    <ul className="space-y-1 sm:space-y-2">
                      <li><Link href="/#features" className="text-gray-600 font-mono text-xs sm:text-sm hover:text-gray-900 transition-colors">Features</Link></li>
                      <li><Link href="/#why-tasky" className="text-gray-600 font-mono text-xs sm:text-sm hover:text-gray-900 transition-colors">Why Tasky</Link></li>
                      <li><Link href="/#how-it-works" className="text-gray-600 font-mono text-xs sm:text-sm hover:text-gray-900 transition-colors">How It Works</Link></li>
                      <li><Link href="/#faq" className="text-gray-600 font-mono text-xs sm:text-sm hover:text-gray-900 transition-colors">FAQ</Link></li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-mono font-bold text-xs sm:text-sm text-gray-900 mb-2 sm:mb-3">Company</h3>
                    <ul className="space-y-1 sm:space-y-2">
                      <li><Link href="/about" className="text-gray-600 font-mono text-xs sm:text-sm hover:text-gray-900 transition-colors">About</Link></li>
                      <li><Link href="/blog" className="text-gray-600 font-mono text-xs sm:text-sm hover:text-gray-900 transition-colors">Blog</Link></li>
                      <li><Link href="/contact" className="text-gray-600 font-mono text-xs sm:text-sm hover:text-gray-900 transition-colors">Contact</Link></li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-mono font-bold text-xs sm:text-sm text-gray-900 mb-2 sm:mb-3">Resources</h3>
                    <ul className="space-y-1 sm:space-y-2">
                      <li><Link href="/#features" className="text-gray-600 font-mono text-xs sm:text-sm hover:text-gray-900 transition-colors">Task Management</Link></li>
                      <li><Link href="/#features" className="text-gray-600 font-mono text-xs sm:text-sm hover:text-gray-900 transition-colors">Team Collaboration</Link></li>
                      <li><Link href="/#faq" className="text-gray-600 font-mono text-xs sm:text-sm hover:text-gray-900 transition-colors">Help &amp; FAQ</Link></li>
                    </ul>
                  </div>
                  <div id="feedback">
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
                    © {new Date().getFullYear()} Tasky. All rights reserved.
                  </p>
                </div>
              </div>
            </footer>
    </div>
  );
}
