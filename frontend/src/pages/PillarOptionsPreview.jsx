import React, { useState } from 'react';
import { Video, Calendar, Target, FileText, Users } from 'lucide-react';

const pillars = [
  { icon: Video, title: 'Video Courses', description: '30+ hours of expert content' },
  { icon: Calendar, title: 'Live Workshops', description: 'Weekly interactive sessions' },
  { icon: Target, title: 'Case Drills', description: '500+ practice exercises' },
  { icon: FileText, title: 'Resources', description: '100+ cases & frameworks' },
  { icon: Users, title: 'Peer Practice', description: 'Smart matching system' }
];

// Option A: Gradient Icon Cards
const OptionA = () => (
  <div className="mb-16">
    <h3 className="text-xl font-bold mb-2 text-center" style={{ color: 'var(--gn-rhino)' }}>Option A: Gradient Icon Cards</h3>
    <p className="text-sm text-center mb-6" style={{ color: 'var(--gn-grey)' }}>Large icons in gradient circular backgrounds with glow on hover</p>
    <div className="grid grid-cols-5 gap-4">
      {pillars.map((pillar, idx) => (
        <div 
          key={idx}
          className="bg-white p-6 rounded-2xl text-center transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer group"
          style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
        >
          <div 
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 transition-all duration-300 group-hover:shadow-lg"
            style={{ 
              background: 'linear-gradient(135deg, var(--gn-rhino) 0%, #8c9dff 100%)',
              boxShadow: '0 4px 15px rgba(140, 157, 255, 0.3)'
            }}
          >
            <pillar.icon className="w-7 h-7 text-white" />
          </div>
          <h4 className="font-bold mb-1" style={{ color: 'var(--gn-rhino)' }}>{pillar.title}</h4>
          <p className="text-xs" style={{ color: 'var(--gn-grey-dark)' }}>{pillar.description}</p>
        </div>
      ))}
    </div>
  </div>
);

// Option B: Glass Morphism Cards
const OptionB = () => (
  <div className="mb-16 p-8 rounded-2xl" style={{ background: 'linear-gradient(135deg, #e8ecff 0%, #f5f7ff 100%)' }}>
    <h3 className="text-xl font-bold mb-2 text-center" style={{ color: 'var(--gn-rhino)' }}>Option B: Glass Morphism Cards</h3>
    <p className="text-sm text-center mb-6" style={{ color: 'var(--gn-grey)' }}>Frosted glass effect with gradient border on hover</p>
    <div className="grid grid-cols-5 gap-4">
      {pillars.map((pillar, idx) => (
        <div 
          key={idx}
          className="p-5 rounded-xl text-center transition-all duration-300 hover:scale-105 cursor-pointer group"
          style={{ 
            background: 'rgba(255, 255, 255, 0.7)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.5)',
            boxShadow: '0 8px 32px rgba(46, 53, 88, 0.1)'
          }}
        >
          <div 
            className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-3"
            style={{ background: 'rgba(140, 157, 255, 0.2)' }}
          >
            <pillar.icon className="w-6 h-6" style={{ color: 'var(--gn-rhino)' }} />
          </div>
          <h4 className="font-bold text-sm mb-1" style={{ color: 'var(--gn-rhino)' }}>{pillar.title}</h4>
          <p className="text-xs" style={{ color: 'var(--gn-grey-dark)' }}>{pillar.description}</p>
        </div>
      ))}
    </div>
  </div>
);

// Option C: Accent Border Cards
const OptionC = () => {
  const accents = ['var(--gn-rhino)', '#8c9dff', '#6366f1', '#4f46e5', '#7c3aed'];
  return (
    <div className="mb-16">
      <h3 className="text-xl font-bold mb-2 text-center" style={{ color: 'var(--gn-rhino)' }}>Option C: Accent Border Cards</h3>
      <p className="text-sm text-center mb-6" style={{ color: 'var(--gn-grey)' }}>White cards with colored top border accent</p>
      <div className="grid grid-cols-5 gap-4">
        {pillars.map((pillar, idx) => (
          <div 
            key={idx}
            className="bg-white p-5 rounded-xl transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer overflow-hidden"
            style={{ 
              boxShadow: '0 4px 15px rgba(0,0,0,0.06)',
              borderTop: `4px solid ${accents[idx]}`
            }}
          >
            <div 
              className="w-12 h-12 rounded-lg flex items-center justify-center mb-3"
              style={{ background: '#e8ecff' }}
            >
              <pillar.icon className="w-6 h-6" style={{ color: accents[idx] }} />
            </div>
            <h4 className="font-bold text-sm mb-1" style={{ color: 'var(--gn-rhino)' }}>{pillar.title}</h4>
            <p className="text-xs" style={{ color: 'var(--gn-grey-dark)' }}>{pillar.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// Option D: Large Icon Tiles
const OptionD = () => (
  <div className="mb-16">
    <h3 className="text-xl font-bold mb-2 text-center" style={{ color: 'var(--gn-rhino)' }}>Option D: Large Icon Tiles</h3>
    <p className="text-sm text-center mb-6" style={{ color: 'var(--gn-grey)' }}>Icon-focused tiles with reveal on hover</p>
    <div className="grid grid-cols-5 gap-4">
      {pillars.map((pillar, idx) => (
        <div 
          key={idx}
          className="relative h-40 rounded-xl overflow-hidden cursor-pointer group"
          style={{ background: idx % 2 === 0 ? 'var(--gn-rhino)' : '#8c9dff' }}
        >
          {/* Pattern overlay */}
          <div 
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
              backgroundSize: '15px 15px'
            }}
          />
          {/* Content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 transition-all duration-300">
            <pillar.icon className="w-10 h-10 text-white mb-3 group-hover:scale-110 transition-transform" />
            <h4 className="font-bold text-sm text-white text-center">{pillar.title}</h4>
            <p className="text-xs text-white/70 text-center mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {pillar.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Option E: Connected Timeline Flow
const OptionE = () => (
  <div className="mb-16">
    <h3 className="text-xl font-bold mb-2 text-center" style={{ color: 'var(--gn-rhino)' }}>Option E: Connected Timeline Flow</h3>
    <p className="text-sm text-center mb-6" style={{ color: 'var(--gn-grey)' }}>Horizontal flow showing progression/journey</p>
    <div className="relative">
      {/* Connection Line */}
      <div 
        className="absolute top-10 left-[10%] right-[10%] h-0.5"
        style={{ background: 'linear-gradient(90deg, var(--gn-rhino) 0%, #8c9dff 100%)' }}
      />
      <div className="grid grid-cols-5 gap-4">
        {pillars.map((pillar, idx) => (
          <div key={idx} className="text-center relative">
            {/* Circle on line */}
            <div 
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 relative z-10 transition-all duration-300 hover:scale-110 cursor-pointer"
              style={{ 
                background: 'white',
                border: '3px solid var(--gn-rhino)',
                boxShadow: '0 4px 20px rgba(46, 53, 88, 0.15)'
              }}
            >
              <pillar.icon className="w-8 h-8" style={{ color: 'var(--gn-rhino)' }} />
            </div>
            <h4 className="font-bold text-sm mb-1" style={{ color: 'var(--gn-rhino)' }}>{pillar.title}</h4>
            <p className="text-xs" style={{ color: 'var(--gn-grey-dark)' }}>{pillar.description}</p>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// Option F: Stacked Cards with Depth
const OptionF = () => {
  const [activeIdx, setActiveIdx] = useState(0);
  return (
    <div className="mb-16">
      <h3 className="text-xl font-bold mb-2 text-center" style={{ color: 'var(--gn-rhino)' }}>Option F: Stacked Cards with Depth</h3>
      <p className="text-sm text-center mb-6" style={{ color: 'var(--gn-grey)' }}>3D perspective, active card comes to front</p>
      <div className="grid grid-cols-5 gap-4" style={{ perspective: '1000px' }}>
        {pillars.map((pillar, idx) => (
          <div 
            key={idx}
            onClick={() => setActiveIdx(idx)}
            className="p-5 rounded-xl cursor-pointer transition-all duration-500"
            style={{ 
              background: activeIdx === idx ? 'var(--gn-rhino)' : 'white',
              boxShadow: activeIdx === idx 
                ? '0 25px 50px rgba(46, 53, 88, 0.3)' 
                : '0 4px 15px rgba(0,0,0,0.08)',
              transform: activeIdx === idx 
                ? 'scale(1.05) translateZ(30px)' 
                : 'scale(1) translateZ(0)',
              zIndex: activeIdx === idx ? 10 : 1
            }}
          >
            <div 
              className="w-12 h-12 rounded-lg flex items-center justify-center mb-3"
              style={{ 
                background: activeIdx === idx ? 'rgba(255,255,255,0.2)' : '#e8ecff'
              }}
            >
              <pillar.icon 
                className="w-6 h-6" 
                style={{ color: activeIdx === idx ? 'white' : 'var(--gn-rhino)' }} 
              />
            </div>
            <h4 
              className="font-bold text-sm mb-1"
              style={{ color: activeIdx === idx ? 'white' : 'var(--gn-rhino)' }}
            >
              {pillar.title}
            </h4>
            <p 
              className="text-xs"
              style={{ color: activeIdx === idx ? 'rgba(255,255,255,0.8)' : 'var(--gn-grey-dark)' }}
            >
              {pillar.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

const PillarOptionsPreview = () => {
  return (
    <div className="min-h-screen py-12 px-8" style={{ background: '#f8f9ff' }}>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-2" style={{ color: 'var(--gn-rhino)' }}>
          Five Pillars Design Options
        </h1>
        <p className="text-center mb-12" style={{ color: 'var(--gn-grey-dark)' }}>
          Click/hover on cards to see interactions
        </p>
        
        <OptionA />
        <OptionB />
        <OptionC />
        <OptionD />
        <OptionE />
        <OptionF />
      </div>
    </div>
  );
};

export default PillarOptionsPreview;
