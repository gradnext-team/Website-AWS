import React from 'react';
import { Clock } from 'lucide-react';

/**
 * CohortSchedule — Case Interview Sprint week-wise schedule rendered as a
 * formal three-column table (Week | Day & Time | Topic) matching the
 * cohort's canonical syllabus.
 *
 * - The Week column is merged across the two weekend sessions in each
 *   week via `rowSpan={2}` so the table reads exactly like the source
 *   spreadsheet.
 * - Each session shows the live time (6:00–8:00 PM IST) right under the
 *   day so it's unmissable at every row.
 * - Each topic ships with a one- or two-line description that sets
 *   expectations for what's actually covered in that session.
 *
 * Admin-editable schedule UI is on the P1 backlog. Until then this
 * component renders the canonical static schedule on every cohort
 * landing page; if the backend exposes `cohort.schedule_weeks` with a
 * compatible shape (`{ week, sessions: [{ day, time, topic, description }] }`)
 * it will be preferred over the static template.
 */
const SESSION_TIME = '6:00 – 8:00 PM IST';

const STATIC_WEEKS = [
  {
    week: 1,
    sessions: [
      {
        day: 'Saturday',
        topic: 'Kick-off and Induction + Platform Introduction + Introduction to Consulting',
        description:
          'Meet your cohort and mentors, get a guided walkthrough of the GradNext platform, and unpack what consulting really involves: the work, the firms and the interview funnel.',
      },
      {
        day: 'Sunday',
        topic: 'How to Approach Cases?',
        description:
          'Build a repeatable mental model for cracking any case: clarifying questions, structure-first thinking, hypothesis-driven analysis and a clear recommendation.',
      },
    ],
  },
  {
    week: 2,
    sessions: [
      {
        day: 'Saturday',
        topic: 'Guesstimates + Live Case Example + Peer Practice',
        description:
          'Master market-sizing and estimation under pressure. Watch a mentor solve a guesstimate live, then practise one yourself with a cohort peer and structured feedback.',
      },
      {
        day: 'Sunday',
        topic: 'Profitability + Live Case Example + Peer Practice',
        description:
          'Apply the profit = revenue − cost framework to real-world cases. Live solve, then partner-up to drill an MBB-style profitability case end to end.',
      },
    ],
  },
  {
    week: 3,
    sessions: [
      {
        day: 'Saturday',
        topic: 'Market Entry Cases + Live Case Example + Peer Practice',
        description:
          'Learn to evaluate new-market opportunities: market attractiveness, capability fit, entry mode and risk. Live case followed by a peer-led practice round.',
      },
      {
        day: 'Sunday',
        topic: 'Pricing & Growth + Live Case Example + Peer Practice',
        description:
          'Cover pricing strategies (cost-plus, value-based, competitive) and growth levers across product, channel and geography. Live solve plus peer practice.',
      },
    ],
  },
  {
    week: 4,
    sessions: [
      {
        day: 'Saturday',
        topic: 'M&A + Live Case Example + Peer Practice',
        description:
          'Walk through the M&A diligence framework: strategic rationale, market & target attractiveness, synergies and deal economics. Live case and peer practice.',
      },
      {
        day: 'Sunday',
        topic: 'Unconventional + Live Case Example + Peer Practice',
        description:
          'Tackle the off-script cases that catch candidates off-guard: operations, public-sector, behavioural-economics styled prompts and creative briefs. Live solve plus a final peer practice round.',
      },
    ],
  },
  {
    bonus: true,
    label: 'Bonus',
    sessions: [
      {
        day: 'Bonus session',
        hideTime: true,
        topic: 'How to build a consulting CV',
        description:
          'A walkthrough of what makes a consulting-grade resume: structure, impact-first bullet writing, signal-rich one-liners and the patterns recruiters actually screen for.',
      },
    ],
  },
];

export default function CohortSchedule({ cohort }) {
  const fromBackend = Array.isArray(cohort?.schedule_weeks) ? cohort.schedule_weeks : [];
  const useBackend =
    fromBackend.length > 0 &&
    fromBackend.every((w) => Array.isArray(w?.sessions) && w.sessions.length);
  const weeks = useBackend ? fromBackend : STATIC_WEEKS;

  const borderColor = 'rgba(140, 157, 255, 0.25)';

  return (
    <section id="schedule" className="section-padding" data-testid="cohort-schedule">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="section-header">
          <h2>Cohort Curriculum</h2>
          <p>
            Cohort kicks off <strong style={{ color: 'var(--gn-rhino)' }}>23 May 2026</strong>. Eight live sessions across four focused weekends,
            every session 6:00–8:00 PM IST, plus a bonus session on building a consulting-grade CV.
          </p>
        </div>

        {/* Time pill above the table */}
        <div className="flex justify-center mb-4">
          <span
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold"
            style={{
              background: 'rgba(255, 166, 1, 0.18)',
              color: 'var(--gn-rhino)',
            }}
          >
            <Clock className="w-3.5 h-3.5" />
            All sessions are live, {SESSION_TIME}
          </span>
        </div>

        <div
          className="rounded-2xl overflow-hidden"
          style={{
            border: `1px solid ${borderColor}`,
            boxShadow: '0 4px 24px rgba(46, 53, 88, 0.06)',
            background: 'white',
          }}
        >
          <div className="overflow-x-auto">
            <table
              className="w-full text-left border-collapse"
              data-testid="cohort-schedule-table"
            >
              <thead>
                <tr
                  style={{
                    background:
                      'linear-gradient(135deg, var(--gn-rhino) 0%, var(--gn-rhino-light) 100%)',
                  }}
                >
                  <th
                    scope="col"
                    className="px-2 sm:px-6 py-4 text-xs sm:text-sm font-bold uppercase tracking-wider text-white text-center w-14 sm:w-24"
                  >
                    Week
                  </th>
                  <th
                    scope="col"
                    className="px-2 sm:px-6 py-4 text-xs sm:text-sm font-bold uppercase tracking-wider text-white text-center w-20 sm:w-44"
                  >
                    <span className="sm:hidden">Day</span>
                    <span className="hidden sm:inline">Day &amp; Time</span>
                  </th>
                  <th
                    scope="col"
                    className="px-3 sm:px-6 py-4 text-xs sm:text-sm font-bold uppercase tracking-wider text-white"
                  >
                    Topic
                  </th>
                </tr>
              </thead>
              <tbody>
                {weeks.map((w, wi) => {
                  const sessions = Array.isArray(w.sessions) ? w.sessions : [];
                  if (sessions.length === 0) return null;
                  const weekNumber = w.week || wi + 1;
                  const isBonus = !!w.bonus;
                  // Visual separation between weeks via a thicker top border
                  // on the FIRST cell of each week (except the very first).
                  return sessions.map((s, si) => {
                    const isFirstSessionOfWeek = si === 0;
                    const isFirstWeek = wi === 0;
                    const topBorder =
                      isFirstSessionOfWeek && !isFirstWeek
                        ? `2px solid ${borderColor}`
                        : `1px solid ${borderColor}`;
                    const time = s.time || SESSION_TIME;
                    const hideTime = !!s.hideTime || isBonus;
                    return (
                      <tr
                        key={`${isBonus ? 'bonus' : weekNumber}-${si}`}
                        data-testid={
                          isBonus
                            ? `cohort-schedule-row-bonus-${si + 1}`
                            : `cohort-schedule-row-${weekNumber}-${si + 1}`
                        }
                      >
                        {isFirstSessionOfWeek && (
                          <td
                            rowSpan={sessions.length}
                            className="px-1 sm:px-6 py-5 sm:py-6 text-center align-middle"
                            style={{
                              borderTop: topBorder,
                              borderRight: `1px solid ${borderColor}`,
                              background: isBonus
                                ? 'rgba(255, 166, 1, 0.1)'
                                : 'rgba(140, 157, 255, 0.06)',
                            }}
                          >
                            {isBonus ? (
                              <span
                                className="inline-block px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-xs font-bold uppercase tracking-wider"
                                style={{
                                  background: 'var(--gn-chrome-yellow)',
                                  color: 'white',
                                }}
                              >
                                {w.label || 'Bonus'}
                              </span>
                            ) : (
                              <span
                                className="text-xl sm:text-3xl font-bold leading-none"
                                style={{ color: 'var(--gn-rhino)' }}
                              >
                                {weekNumber}
                              </span>
                            )}
                          </td>
                        )}
                        <td
                          className="px-1.5 sm:px-6 py-4 sm:py-6 text-center align-middle"
                          style={{
                            borderTop: topBorder,
                            borderRight: `1px solid ${borderColor}`,
                          }}
                        >
                          <div
                            className="text-[11px] sm:text-sm font-semibold leading-tight break-words"
                            style={{ color: 'var(--gn-rhino)' }}
                          >
                            {s.day}
                          </div>
                          {!hideTime && (
                            <div
                              className="mt-1 inline-flex items-start sm:items-center justify-center gap-0.5 sm:gap-1 text-[9px] sm:text-xs font-medium leading-tight"
                              style={{ color: 'var(--gn-grey-dark)' }}
                            >
                              <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 mt-0.5 sm:mt-0 flex-shrink-0" />
                              <span className="break-words">{time}</span>
                            </div>
                          )}
                        </td>
                        <td
                          className="px-3 sm:px-6 py-4 sm:py-6 align-top"
                          style={{
                            borderTop: topBorder,
                            color: 'var(--gn-rhino)',
                          }}
                        >
                          <div className="text-sm sm:text-base font-semibold leading-snug break-words">
                            {s.topic}
                          </div>
                          {s.description && (
                            <p
                              className="mt-1.5 text-xs sm:text-sm leading-relaxed break-words"
                              style={{ color: 'var(--gn-grey-dark)' }}
                            >
                              {s.description}
                            </p>
                          )}
                        </td>
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
