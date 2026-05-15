import React, { useState, useEffect } from 'react';

const DesignMockups = () => {
  const [activeRing, setActiveRing] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveRing(prev => (prev + 1) % 3);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen p-8" style={{ background: 'linear-gradient(180deg, #fdfeff 0%, #f8f9ff 50%, #f5f7ff 100%)' }}>
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-4" style={{ color: 'var(--gn-rhino)' }}>
          Design Mockups: "How Does It Work?" Section
        </h1>
        <p className="text-center mb-12" style={{ color: 'var(--gn-grey-dark)' }}>
          5 different approaches to replace icons while keeping premium feel
        </p>

        {/* Option A: Animated Progress Rings */}
        <div className="mb-16">
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--gn-rhino)' }}>Option A: Animated Progress Rings / Metrics</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--gn-grey-dark)' }}>Circular progress indicators with animations showing completion</p>
          
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { title: 'Onboarding', progress: 85, label: 'Profile Complete', desc: 'Complete your profile and tell us about your background.' },
              { title: 'Strategy Call', progress: 60, label: 'Journey Progress', desc: 'Plan your preparation roadmap with your coach.' },
              { title: 'Mock Interviews', progress: 40, label: 'Sessions Done', desc: 'Practice with real consultants from MBB firms.' }
            ].map((step, idx) => (
              <div 
                key={idx}
                className="relative rounded-2xl p-6 bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                style={{ boxShadow: '0 4px 24px rgba(46, 53, 88, 0.08)' }}
              >
                <div className="flex items-start gap-4 mb-4">
                  {/* Animated Progress Ring */}
                  <div className="relative w-16 h-16 flex-shrink-0">
                    <svg className="w-16 h-16 -rotate-90">
                      <circle
                        cx="32"
                        cy="32"
                        r="28"
                        stroke="#e5e7eb"
                        strokeWidth="6"
                        fill="none"
                      />
                      <circle
                        cx="32"
                        cy="32"
                        r="28"
                        stroke="var(--gn-periwinkle)"
                        strokeWidth="6"
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={`${step.progress * 1.76} 176`}
                        className="transition-all duration-1000"
                        style={{
                          filter: activeRing === idx ? 'drop-shadow(0 0 8px var(--gn-periwinkle))' : 'none'
                        }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg font-bold" style={{ color: 'var(--gn-rhino)' }}>{step.progress}%</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs font-medium px-2 py-1 rounded-full" style={{ backgroundColor: 'rgba(140, 157, 255, 0.15)', color: 'var(--gn-periwinkle)' }}>
                      {step.label}
                    </span>
                  </div>
                </div>
                <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--gn-rhino)' }}>{step.title}</h3>
                <p className="text-sm" style={{ color: 'var(--gn-grey-dark)' }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Option B: Floating UI Elements */}
        <div className="mb-16">
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--gn-rhino)' }}>Option B: Floating UI Elements with Animation</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--gn-grey-dark)' }}>Small floating badges, notifications, and checkmarks with subtle animations</p>
          
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { title: 'Onboarding', desc: 'Complete your profile and tell us about your background.' },
              { title: 'Strategy Call', desc: 'Plan your preparation roadmap with your coach.' },
              { title: 'Mock Interviews', desc: 'Practice with real consultants from MBB firms.' }
            ].map((step, idx) => (
              <div 
                key={idx}
                className="relative rounded-2xl p-6 bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-xl overflow-hidden"
                style={{ boxShadow: '0 4px 24px rgba(46, 53, 88, 0.08)' }}
              >
                {/* Floating Elements */}
                <div className="relative h-24 mb-4">
                  {/* Main card mockup */}
                  <div 
                    className="absolute left-0 top-2 w-3/4 bg-slate-50 rounded-lg p-3 animate-pulse"
                    style={{ animationDuration: '3s' }}
                  >
                    <div className="h-2 w-2/3 bg-slate-200 rounded mb-2"></div>
                    <div className="h-2 w-1/2 bg-slate-200 rounded"></div>
                  </div>
                  
                  {/* Floating notification badge */}
                  <div 
                    className="absolute right-4 top-0 px-3 py-1.5 rounded-full text-xs font-bold text-white shadow-lg"
                    style={{ 
                      backgroundColor: 'var(--gn-chrome-yellow)',
                      animation: 'bounce 2s infinite',
                      color: 'var(--gn-rhino)'
                    }}
                  >
                    {idx === 0 ? '✓ Done' : idx === 1 ? 'Scheduled' : '3 Left'}
                  </div>
                  
                  {/* Floating checkmark */}
                  <div 
                    className="absolute right-0 bottom-0 w-8 h-8 rounded-full flex items-center justify-center shadow-md"
                    style={{ 
                      backgroundColor: 'var(--gn-periwinkle)',
                      animation: 'pulse 2s infinite'
                    }}
                  >
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  
                  {/* Small floating dot */}
                  <div 
                    className="absolute left-1/2 top-1/2 w-3 h-3 rounded-full"
                    style={{ 
                      backgroundColor: 'var(--gn-periwinkle)',
                      opacity: 0.5,
                      animation: 'ping 1.5s infinite'
                    }}
                  ></div>
                </div>
                
                <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--gn-rhino)' }}>{step.title}</h3>
                <p className="text-sm" style={{ color: 'var(--gn-grey-dark)' }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Option C: Gradient Number Badges */}
        <div className="mb-16">
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--gn-rhino)' }}>Option C: Gradient Number Badges + Micro Interactions</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--gn-grey-dark)' }}>Large step numbers with gradient backgrounds and hover effects</p>
          
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { num: '01', title: 'Onboarding', desc: 'Complete your profile and tell us about your background.' },
              { num: '02', title: 'Strategy Call', desc: 'Plan your preparation roadmap with your coach.' },
              { num: '03', title: 'Mock Interviews', desc: 'Practice with real consultants from MBB firms.' }
            ].map((step, idx) => (
              <div 
                key={idx}
                className="relative rounded-2xl p-6 bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-xl group"
                style={{ boxShadow: '0 4px 24px rgba(46, 53, 88, 0.08)' }}
              >
                {/* Large Gradient Number */}
                <div className="mb-4 flex items-center gap-4">
                  <div 
                    className="w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110"
                    style={{ 
                      background: `linear-gradient(135deg, var(--gn-periwinkle) 0%, var(--gn-rhino-light) 100%)`,
                      boxShadow: '0 4px 20px rgba(140, 157, 255, 0.4)'
                    }}
                  >
                    <span className="text-2xl font-bold text-white">{step.num}</span>
                  </div>
                  <div className="flex-1 h-1 rounded-full bg-slate-100 overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500 group-hover:w-full"
                      style={{ 
                        width: idx === 0 ? '100%' : idx === 1 ? '66%' : '33%',
                        background: 'linear-gradient(90deg, var(--gn-periwinkle) 0%, var(--gn-chrome-yellow) 100%)'
                      }}
                    ></div>
                  </div>
                </div>
                
                <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--gn-rhino)' }}>{step.title}</h3>
                <p className="text-sm" style={{ color: 'var(--gn-grey-dark)' }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Option D: Abstract Geometric Shapes */}
        <div className="mb-16">
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--gn-rhino)' }}>Option D: Abstract Geometric Shapes</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--gn-grey-dark)' }}>Subtle animated geometric shapes representing each concept</p>
          
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { title: 'Onboarding', desc: 'Complete your profile and tell us about your background.' },
              { title: 'Strategy Call', desc: 'Plan your preparation roadmap with your coach.' },
              { title: 'Mock Interviews', desc: 'Practice with real consultants from MBB firms.' }
            ].map((step, idx) => (
              <div 
                key={idx}
                className="relative rounded-2xl p-6 bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-xl overflow-hidden"
                style={{ boxShadow: '0 4px 24px rgba(46, 53, 88, 0.08)' }}
              >
                {/* Geometric Shapes Container */}
                <div className="relative h-24 mb-4">
                  {idx === 0 && (
                    <>
                      {/* Stacked circles for onboarding */}
                      <div className="absolute left-4 top-2 w-12 h-12 rounded-full border-4 opacity-30" style={{ borderColor: 'var(--gn-periwinkle)', animation: 'pulse 3s infinite' }}></div>
                      <div className="absolute left-8 top-6 w-12 h-12 rounded-full border-4 opacity-50" style={{ borderColor: 'var(--gn-periwinkle)', animation: 'pulse 3s infinite 0.5s' }}></div>
                      <div className="absolute left-12 top-2 w-12 h-12 rounded-full opacity-80" style={{ backgroundColor: 'var(--gn-periwinkle)', animation: 'pulse 3s infinite 1s' }}></div>
                    </>
                  )}
                  {idx === 1 && (
                    <>
                      {/* Connected dots for strategy */}
                      <div className="absolute left-4 top-8 w-4 h-4 rounded-full" style={{ backgroundColor: 'var(--gn-periwinkle)' }}></div>
                      <div className="absolute left-10 top-8 w-20 h-0.5" style={{ backgroundColor: 'var(--gn-periwinkle)', opacity: 0.5 }}></div>
                      <div className="absolute left-28 top-4 w-6 h-6 rounded-full" style={{ backgroundColor: 'var(--gn-chrome-yellow)' }}></div>
                      <div className="absolute left-32 top-7 w-12 h-0.5 rotate-45" style={{ backgroundColor: 'var(--gn-periwinkle)', opacity: 0.5 }}></div>
                      <div className="absolute right-8 top-12 w-5 h-5 rounded-full" style={{ backgroundColor: 'var(--gn-periwinkle)' }}></div>
                    </>
                  )}
                  {idx === 2 && (
                    <>
                      {/* Overlapping rectangles for practice */}
                      <div className="absolute left-2 top-2 w-16 h-10 rounded-lg opacity-30" style={{ backgroundColor: 'var(--gn-periwinkle)', transform: 'rotate(-5deg)' }}></div>
                      <div className="absolute left-8 top-4 w-16 h-10 rounded-lg opacity-50" style={{ backgroundColor: 'var(--gn-periwinkle)', transform: 'rotate(3deg)' }}></div>
                      <div className="absolute left-14 top-6 w-16 h-10 rounded-lg opacity-80" style={{ backgroundColor: 'var(--gn-periwinkle)', transform: 'rotate(-2deg)' }}></div>
                    </>
                  )}
                </div>
                
                <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--gn-rhino)' }}>{step.title}</h3>
                <p className="text-sm" style={{ color: 'var(--gn-grey-dark)' }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Option E: Mini Data Visualization */}
        <div className="mb-16">
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--gn-rhino)' }}>Option E: Mini Data Visualization</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--gn-grey-dark)' }}>Tiny charts and graphs showing progress and stats</p>
          
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { title: 'Onboarding', desc: 'Complete your profile and tell us about your background.' },
              { title: 'Strategy Call', desc: 'Plan your preparation roadmap with your coach.' },
              { title: 'Mock Interviews', desc: 'Practice with real consultants from MBB firms.' }
            ].map((step, idx) => (
              <div 
                key={idx}
                className="relative rounded-2xl p-6 bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                style={{ boxShadow: '0 4px 24px rgba(46, 53, 88, 0.08)' }}
              >
                {/* Mini Dashboard Card */}
                <div className="bg-slate-50 rounded-xl p-4 mb-4">
                  {idx === 0 && (
                    <>
                      {/* Checklist completion */}
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium" style={{ color: 'var(--gn-grey-dark)' }}>Setup Progress</span>
                        <span className="text-xs font-bold" style={{ color: 'var(--gn-periwinkle)' }}>85%</span>
                      </div>
                      <div className="space-y-2">
                        {[true, true, true, false].map((done, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-sm ${done ? '' : 'border-2'}`} style={{ backgroundColor: done ? 'var(--gn-chrome-yellow)' : 'transparent', borderColor: done ? 'transparent' : 'var(--gn-grey)' }}></div>
                            <div className="flex-1 h-1.5 rounded-full bg-slate-200">
                              <div className="h-full rounded-full" style={{ width: done ? '100%' : '0%', backgroundColor: 'var(--gn-periwinkle)' }}></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {idx === 1 && (
                    <>
                      {/* Timeline visualization */}
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium" style={{ color: 'var(--gn-grey-dark)' }}>Your Journey</span>
                        <span className="text-xs font-bold" style={{ color: 'var(--gn-periwinkle)' }}>Week 2</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {[100, 100, 60, 0, 0, 0].map((h, i) => (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1">
                            <div className="w-full h-8 rounded-sm bg-slate-200 relative overflow-hidden">
                              <div 
                                className="absolute bottom-0 w-full rounded-sm transition-all"
                                style={{ height: `${h}%`, backgroundColor: h === 100 ? 'var(--gn-periwinkle)' : h > 0 ? 'var(--gn-chrome-yellow)' : 'transparent' }}
                              ></div>
                            </div>
                            <span className="text-[8px]" style={{ color: 'var(--gn-grey)' }}>W{i + 1}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {idx === 2 && (
                    <>
                      {/* Donut chart */}
                      <div className="flex items-center gap-4">
                        <div className="relative w-16 h-16">
                          <svg className="w-16 h-16 -rotate-90">
                            <circle cx="32" cy="32" r="24" stroke="#e5e7eb" strokeWidth="8" fill="none" />
                            <circle cx="32" cy="32" r="24" stroke="var(--gn-periwinkle)" strokeWidth="8" fill="none" strokeDasharray="100 150" strokeLinecap="round" />
                            <circle cx="32" cy="32" r="24" stroke="var(--gn-chrome-yellow)" strokeWidth="8" fill="none" strokeDasharray="40 150" strokeDashoffset="-100" strokeLinecap="round" />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-sm font-bold" style={{ color: 'var(--gn-rhino)' }}>6/10</span>
                          </div>
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2 text-[10px]">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--gn-periwinkle)' }}></div>
                            <span style={{ color: 'var(--gn-grey-dark)' }}>Completed</span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px]">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--gn-chrome-yellow)' }}></div>
                            <span style={{ color: 'var(--gn-grey-dark)' }}>Scheduled</span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px]">
                            <div className="w-2 h-2 rounded-full bg-slate-200"></div>
                            <span style={{ color: 'var(--gn-grey-dark)' }}>Remaining</span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                
                <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--gn-rhino)' }}>{step.title}</h3>
                <p className="text-sm" style={{ color: 'var(--gn-grey-dark)' }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
      
      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @keyframes ping {
          0% { transform: scale(1); opacity: 1; }
          75%, 100% { transform: scale(2); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default DesignMockups;
