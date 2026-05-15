import React from 'react';
import {
  Users as PhUsers,
  Crown as PhCrown,
  ChatTeardropDots as PhChat,
  GraduationCap as PhGradCap,
  Briefcase as PhBriefcase,
  CheckCircle as PhCheck,
  Globe as PhGlobe,
  Sparkle as PhSparkle,
} from '@phosphor-icons/react';

/**
 * CohortWhatYouLearn — Bento grid showcasing the five concrete
 * deliverables of the cohort:
 *   1. Featured (2x2): 20 hours of live learning sessions
 *   2. 1:1 MBB sessions
 *   3. 15+ live cases
 *   4. Pro+ subscription access (700+ exercises and drills)
 *   5. Peer-to-peer connect with global peers
 *
 * The 20-hour live commitment is the visual anchor; the four supporting
 * tiles fill the remaining 2-column × 2-row block to its right.
 */
export default function CohortWhatYouLearn() {
  return (
    <section id="learn" className="section-padding" data-testid="cohort-learn">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="section-header">
          <h2>Building the fundamentals of consulting and building a strong foundation</h2>
          <p>Everything you get inside the cohort, designed to take you from zero to interview-ready.</p>
        </div>

        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
          style={{ gridAutoRows: 'minmax(180px, auto)' }}
        >
          {/* Featured 2x2: 20 hours of live learning */}
          <div className="md:col-span-2 md:row-span-2 group cursor-default">
            <div
              className="relative h-full rounded-2xl p-6 transition-all duration-500 hover:translate-y-[-4px] overflow-hidden"
              style={{
                background:
                  'linear-gradient(135deg, var(--gn-rhino) 0%, var(--gn-rhino-light) 100%)',
                boxShadow: '0 8px 32px rgba(46, 53, 88, 0.25)',
              }}
              data-testid="learn-card-live-learning"
            >
              <div
                className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-15"
                style={{ background: 'var(--gn-periwinkle)' }}
              />
              <div
                className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full opacity-10"
                style={{ background: 'var(--gn-periwinkle-light)' }}
              />

              <div className="relative z-10 h-full flex flex-col">
                <div className="flex items-center gap-3 mb-6">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(255, 166, 1, 0.25)' }}
                  >
                    <PhGradCap className="w-7 h-7 text-white" weight="duotone" />
                  </div>
                  <span
                    className="text-sm font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--gn-chrome-light)' }}
                  >
                    Live Cohort
                  </span>
                </div>

                <div className="flex-1 flex flex-col justify-center">
                  <h3 className="text-3xl md:text-4xl font-bold text-white mb-3 break-words">
                    20 hours of learning live sessions
                  </h3>
                  <p className="text-white/80 text-base leading-relaxed mb-4 break-words">
                    Eight live classes over four weekends, taught in real time by McKinsey,
                    BCG and Bain consultants. Ask questions live, work through cases together,
                    leave with frameworks you actually internalised.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-auto">
                  {[
                    '8 live classes',
                    '4 focused weekends',
                    'Taught by MBB consultants',
                    'Live peer practice',
                  ].map((label, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg"
                      style={{ backgroundColor: 'rgba(140, 157, 255, 0.18)' }}
                    >
                      <PhCheck
                        className="w-4 h-4 flex-shrink-0"
                        weight="duotone"
                        style={{ color: 'var(--gn-chrome-light)' }}
                      />
                      <span className="text-white text-xs font-medium break-words">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 1:1 MBB Sessions */}
          <div className="group cursor-default">
            <div
              className="relative h-full rounded-2xl p-5 transition-all duration-500 hover:translate-y-[-4px] hover:shadow-xl"
              style={{
                background: 'rgba(255, 255, 255, 0.85)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(140, 157, 255, 0.2)',
                boxShadow: '0 8px 32px rgba(46, 53, 88, 0.08)',
              }}
              data-testid="learn-card-mbb-sessions"
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-3"
                style={{
                  background:
                    'linear-gradient(135deg, var(--gn-periwinkle) 0%, var(--gn-rhino-light) 100%)',
                }}
              >
                <PhChat className="w-6 h-6 text-white" weight="duotone" />
              </div>
              <div className="text-3xl font-bold mb-1" style={{ color: 'var(--gn-rhino)' }}>
                1:1
              </div>
              <h3 className="font-semibold text-sm mb-1 break-words" style={{ color: 'var(--gn-rhino)' }}>
                Sessions with MBB consultants
              </h3>
              <p className="text-xs break-words" style={{ color: 'var(--gn-grey-dark)' }}>
                Personalised mock interview and feedback time with a consultant from McKinsey, BCG or Bain.
              </p>
            </div>
          </div>

          {/* 15+ live cases */}
          <div className="group cursor-default">
            <div
              className="relative h-full rounded-2xl p-5 transition-all duration-500 hover:translate-y-[-4px] hover:shadow-xl"
              style={{
                background: 'rgba(255, 255, 255, 0.85)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(140, 157, 255, 0.2)',
                boxShadow: '0 8px 32px rgba(46, 53, 88, 0.08)',
              }}
              data-testid="learn-card-live-cases"
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-3"
                style={{
                  background:
                    'linear-gradient(135deg, var(--gn-rhino-light) 0%, var(--gn-rhino-medium) 100%)',
                }}
              >
                <PhBriefcase className="w-6 h-6 text-white" weight="duotone" />
              </div>
              <div className="text-3xl font-bold mb-1" style={{ color: 'var(--gn-rhino)' }}>
                15+
              </div>
              <h3 className="font-semibold text-sm mb-1 break-words" style={{ color: 'var(--gn-rhino)' }}>
                Live cases
              </h3>
              <p className="text-xs break-words" style={{ color: 'var(--gn-grey-dark)' }}>
                Profitability, market entry, pricing, M&amp;A and unconventional cases solved together in class.
              </p>
            </div>
          </div>

          {/* Pro+ subscription access */}
          <div className="group cursor-default">
            <div
              className="relative h-full rounded-2xl p-5 transition-all duration-500 hover:translate-y-[-4px] hover:shadow-xl"
              style={{
                background: 'rgba(255, 255, 255, 0.85)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(140, 157, 255, 0.2)',
                boxShadow: '0 8px 32px rgba(46, 53, 88, 0.08)',
              }}
              data-testid="learn-card-proplus"
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-3"
                style={{
                  background:
                    'linear-gradient(135deg, var(--gn-chrome-light) 0%, var(--gn-chrome-yellow) 100%)',
                }}
              >
                <PhCrown className="w-6 h-6 text-white" weight="duotone" />
              </div>
              <div className="text-xl font-bold mb-1 leading-tight" style={{ color: 'var(--gn-rhino)' }}>
                Full Preparation Library
              </div>
              <h3 className="font-semibold text-sm mb-1 break-words" style={{ color: 'var(--gn-rhino)' }}>
                Pro+ subscription access
              </h3>
              <p className="text-xs break-words" style={{ color: 'var(--gn-grey-dark)' }}>
                700+ exercises, drills, video courses and case banks. Practise on your own schedule, anytime.
              </p>
            </div>
          </div>

          {/* Peer-to-peer global community */}
          <div className="group cursor-default">
            <div
              className="relative h-full rounded-2xl p-5 transition-all duration-500 hover:translate-y-[-4px] hover:shadow-xl overflow-hidden"
              style={{
                background:
                  'linear-gradient(135deg, rgba(140, 157, 255, 0.18) 0%, rgba(255, 255, 255, 0.9) 100%)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(140, 157, 255, 0.25)',
                boxShadow: '0 8px 32px rgba(46, 53, 88, 0.08)',
              }}
              data-testid="learn-card-peer-community"
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-3"
                style={{
                  background:
                    'linear-gradient(135deg, var(--gn-rhino) 0%, var(--gn-rhino-light) 100%)',
                }}
              >
                <PhUsers className="w-6 h-6 text-white" weight="duotone" />
              </div>
              <h3 className="font-semibold text-sm mb-1 break-words" style={{ color: 'var(--gn-rhino)' }}>
                Peer-to-peer connect with global peers
              </h3>
              <p className="text-xs break-words" style={{ color: 'var(--gn-grey-dark)' }}>
                Practise cases, swap notes and stay accountable with cohort-mates from across the world.
              </p>
            </div>
          </div>
        </div>

        {/* Trust strip below the bento */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm" style={{ color: 'var(--gn-grey-dark)' }}>
          <span className="inline-flex items-center gap-1.5">
            <PhSparkle className="w-4 h-4" weight="duotone" style={{ color: 'var(--gn-chrome-yellow)' }} />
            Live cohort, capped seats
          </span>
          <span className="inline-flex items-center gap-1.5">
            <PhGlobe className="w-4 h-4" weight="duotone" style={{ color: 'var(--gn-periwinkle)' }} />
            Open to candidates worldwide
          </span>
        </div>
      </div>
    </section>
  );
}
