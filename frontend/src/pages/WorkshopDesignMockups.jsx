import React, { useState } from 'react';
import { Calendar, Clock, Play, User, ChevronRight, Star, Users, ArrowRight, CheckCircle, Lock } from 'lucide-react';
import { Button } from '../components/ui/button';

// Sample workshop data for mockups
const sampleUpcoming = [
  {
    id: '1',
    title: 'Market Sizing Masterclass',
    description: 'Learn the frameworks and techniques used by top consultants to crack market sizing cases.',
    instructor: 'Kritika Sharma',
    instructor_title: 'Ex-McKinsey',
    date: '2026-03-01',
    time: '18:00',
    duration: '2 hours',
    thumbnail: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800',
    is_registered: false,
    spots_left: 12
  },
  {
    id: '2',
    title: 'Profitability Deep Dive',
    description: 'Master the art of profitability analysis with real case examples from top firms.',
    instructor: 'Arpit Agrawal',
    instructor_title: 'Ex-BCG',
    date: '2026-03-05',
    time: '19:00',
    duration: '1.5 hours',
    thumbnail: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800',
    is_registered: true,
    spots_left: 5
  },
  {
    id: '3',
    title: 'M&A Case Framework',
    description: 'Comprehensive guide to approaching merger and acquisition cases.',
    instructor: 'Kashish Malhotra',
    instructor_title: 'Ex-Bain',
    date: '2026-03-10',
    time: '17:30',
    duration: '2 hours',
    thumbnail: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800',
    is_registered: false,
    spots_left: 20
  }
];

const samplePast = [
  {
    id: '4',
    title: 'Structuring 101',
    description: 'Foundation workshop on case structuring techniques.',
    instructor: 'Aparajita S.',
    duration: '1h 45m',
    thumbnail: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800',
    views: 1250
  },
  {
    id: '5',
    title: 'Mental Math Bootcamp',
    description: 'Speed up your calculations for case interviews.',
    instructor: 'Kritika Sharma',
    duration: '1h 20m',
    thumbnail: 'https://images.unsplash.com/photo-1596496050827-8299e0220de1?w=800',
    views: 890
  },
  {
    id: '6',
    title: 'Operations Cases',
    description: 'Deep dive into operations and supply chain cases.',
    instructor: 'Arpit Agrawal',
    duration: '2h 10m',
    thumbnail: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800',
    views: 650
  },
  {
    id: '7',
    title: 'Pricing Strategy',
    description: 'Master pricing cases with proven frameworks.',
    instructor: 'Kashish Malhotra',
    duration: '1h 30m',
    thumbnail: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800',
    views: 720
  }
];

const WorkshopDesignMockups = () => {
  const [activeOption, setActiveOption] = useState('A');

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Option A: Modern Card Grid with Hero
  const OptionA = () => (
    <div className="space-y-8">
      {/* Hero - Next Upcoming Workshop */}
      <div className="relative rounded-2xl overflow-hidden h-[400px]">
        <img 
          src={sampleUpcoming[0].thumbnail} 
          alt="" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
        <div className="absolute inset-0 p-8 flex flex-col justify-end">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500 text-black text-sm font-medium mb-4">
              <span className="w-2 h-2 rounded-full bg-black animate-pulse" />
              Next Workshop
            </span>
            <h2 className="text-4xl font-bold text-white mb-3">{sampleUpcoming[0].title}</h2>
            <p className="text-white/80 text-lg mb-4">{sampleUpcoming[0].description}</p>
            <div className="flex items-center gap-6 text-white/70 mb-6">
              <span className="flex items-center gap-2">
                <User className="w-5 h-5" />
                {sampleUpcoming[0].instructor} · {sampleUpcoming[0].instructor_title}
              </span>
              <span className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                {formatDate(sampleUpcoming[0].date)}
              </span>
              <span className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                {sampleUpcoming[0].time} IST
              </span>
            </div>
            <div className="flex gap-4">
              <Button className="bg-white text-black hover:bg-white/90 px-8 py-6 text-lg">
                Register Now
              </Button>
              <Button variant="outline" className="border-white text-white hover:bg-white/10 px-8 py-6 text-lg">
                Learn More
              </Button>
            </div>
          </div>
        </div>
        {/* Countdown */}
        <div className="absolute top-8 right-8 bg-white/10 backdrop-blur-md rounded-xl p-4">
          <p className="text-white/60 text-sm mb-2">Starts in</p>
          <div className="flex gap-3">
            {['5', '12', '30'].map((num, i) => (
              <div key={i} className="text-center">
                <div className="text-3xl font-bold text-white">{num}</div>
                <div className="text-xs text-white/60">{['Days', 'Hours', 'Mins'][i]}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* More Upcoming */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-slate-900">More Upcoming Workshops</h3>
          <Button variant="ghost" className="text-blue-600">View All <ChevronRight className="w-4 h-4 ml-1" /></Button>
        </div>
        <div className="flex gap-6 overflow-x-auto pb-4">
          {sampleUpcoming.slice(1).map((workshop) => (
            <div key={workshop.id} className="flex-shrink-0 w-80 bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all hover:-translate-y-1">
              <div className="relative h-40">
                <img src={workshop.thumbnail} alt="" className="w-full h-full object-cover" />
                {workshop.is_registered && (
                  <div className="absolute top-3 right-3 bg-green-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Registered
                  </div>
                )}
              </div>
              <div className="p-4">
                <h4 className="font-semibold text-slate-900 mb-1">{workshop.title}</h4>
                <p className="text-sm text-slate-500 mb-3">{workshop.instructor} · {workshop.instructor_title}</p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{formatDate(workshop.date)} · {workshop.time}</span>
                  <span className="text-orange-600 font-medium">{workshop.spots_left} spots left</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Past Recordings */}
      <div>
        <h3 className="text-xl font-semibold text-slate-900 mb-6">Past Workshop Recordings</h3>
        <div className="grid grid-cols-4 gap-6">
          {samplePast.map((workshop) => (
            <div key={workshop.id} className="group cursor-pointer">
              <div className="relative aspect-video rounded-xl overflow-hidden mb-3">
                <img src={workshop.thumbnail} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center">
                    <Play className="w-6 h-6 text-slate-900 ml-1" />
                  </div>
                </div>
                <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/70 text-white text-xs">{workshop.duration}</div>
              </div>
              <h4 className="font-medium text-slate-900 group-hover:text-blue-600 transition-colors">{workshop.title}</h4>
              <p className="text-sm text-slate-500">{workshop.instructor} · {workshop.views} views</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Option B: Split Panel Design
  const OptionB = () => (
    <div className="flex gap-8 min-h-[600px]">
      {/* Left Panel - Upcoming List */}
      <div className="w-2/5 space-y-4">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Upcoming Workshops</h3>
        {sampleUpcoming.map((workshop, idx) => (
          <div 
            key={workshop.id} 
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
              idx === 0 ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex gap-4">
              <div className="w-16 text-center">
                <div className="text-2xl font-bold text-slate-900">{new Date(workshop.date).getDate()}</div>
                <div className="text-xs text-slate-500 uppercase">{new Date(workshop.date).toLocaleDateString('en-US', { month: 'short' })}</div>
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-slate-900">{workshop.title}</h4>
                <p className="text-sm text-slate-500">{workshop.time} IST · {workshop.duration}</p>
                <div className="flex items-center gap-2 mt-2">
                  {workshop.is_registered ? (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Registered</span>
                  ) : (
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">{workshop.spots_left} spots left</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        <div className="pt-6 border-t mt-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Past Recordings</h3>
          <div className="space-y-3">
            {samplePast.slice(0, 3).map((workshop) => (
              <div key={workshop.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                <div className="relative w-20 h-12 rounded overflow-hidden flex-shrink-0">
                  <img src={workshop.thumbnail} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Play className="w-4 h-4 text-white" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h5 className="text-sm font-medium text-slate-900 truncate">{workshop.title}</h5>
                  <p className="text-xs text-slate-500">{workshop.duration}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Selected Workshop Details */}
      <div className="flex-1 bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="relative h-64">
          <img src={sampleUpcoming[0].thumbnail} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        </div>
        <div className="p-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="bg-blue-100 text-blue-700 text-xs px-3 py-1 rounded-full font-medium">Live Workshop</span>
            <span className="bg-slate-100 text-slate-600 text-xs px-3 py-1 rounded-full">{sampleUpcoming[0].duration}</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-3">{sampleUpcoming[0].title}</h2>
          <p className="text-slate-600 mb-6">{sampleUpcoming[0].description}</p>
          
          <div className="flex items-center gap-4 mb-6 p-4 bg-slate-50 rounded-xl">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
              {sampleUpcoming[0].instructor.charAt(0)}
            </div>
            <div>
              <p className="font-semibold text-slate-900">{sampleUpcoming[0].instructor}</p>
              <p className="text-sm text-slate-500">{sampleUpcoming[0].instructor_title}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="flex items-center gap-3 text-slate-600">
              <Calendar className="w-5 h-5" />
              <span>{formatDate(sampleUpcoming[0].date)}</span>
            </div>
            <div className="flex items-center gap-3 text-slate-600">
              <Clock className="w-5 h-5" />
              <span>{sampleUpcoming[0].time} IST</span>
            </div>
            <div className="flex items-center gap-3 text-slate-600">
              <Users className="w-5 h-5" />
              <span>{sampleUpcoming[0].spots_left} spots remaining</span>
            </div>
          </div>

          <Button className="w-full py-6 text-lg bg-blue-600 hover:bg-blue-700">
            Register for Workshop
          </Button>
        </div>
      </div>
    </div>
  );

  // Option C: Timeline + Gallery
  const OptionC = () => (
    <div className="space-y-12">
      {/* Timeline for Upcoming */}
      <div>
        <h3 className="text-xl font-semibold text-slate-900 mb-8">Upcoming Workshops</h3>
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-slate-200" />
          
          {sampleUpcoming.map((workshop, idx) => (
            <div key={workshop.id} className="relative flex gap-8 mb-8">
              {/* Timeline dot */}
              <div className={`relative z-10 w-16 h-16 rounded-full flex flex-col items-center justify-center ${
                idx === 0 ? 'bg-blue-600 text-white' : 'bg-white border-2 border-slate-200'
              }`}>
                <span className={`text-lg font-bold ${idx === 0 ? 'text-white' : 'text-slate-900'}`}>
                  {new Date(workshop.date).getDate()}
                </span>
                <span className={`text-xs uppercase ${idx === 0 ? 'text-blue-100' : 'text-slate-500'}`}>
                  {new Date(workshop.date).toLocaleDateString('en-US', { month: 'short' })}
                </span>
              </div>
              
              {/* Workshop Card */}
              <div className={`flex-1 rounded-xl overflow-hidden ${
                idx === 0 ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6' : 'bg-white border border-slate-200 p-6'
              }`}>
                <div className="flex gap-6">
                  <img 
                    src={workshop.thumbnail} 
                    alt="" 
                    className="w-48 h-32 object-cover rounded-lg"
                  />
                  <div className="flex-1">
                    <h4 className={`text-xl font-semibold mb-2 ${idx === 0 ? 'text-white' : 'text-slate-900'}`}>
                      {workshop.title}
                    </h4>
                    <p className={`mb-4 ${idx === 0 ? 'text-white/80' : 'text-slate-500'}`}>
                      {workshop.description}
                    </p>
                    <div className="flex items-center gap-4">
                      <span className={idx === 0 ? 'text-white/70' : 'text-slate-600'}>
                        {workshop.time} IST · {workshop.duration}
                      </span>
                      <Button variant={idx === 0 ? 'secondary' : 'default'} size="sm">
                        {workshop.is_registered ? 'Registered ✓' : 'Register'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Netflix-style Carousel for Past */}
      <div>
        <h3 className="text-xl font-semibold text-slate-900 mb-6">Workshop Library</h3>
        
        <div className="space-y-8">
          <div>
            <h4 className="text-slate-600 font-medium mb-4">Popular This Week</h4>
            <div className="flex gap-4 overflow-x-auto pb-4">
              {samplePast.map((workshop) => (
                <div key={workshop.id} className="flex-shrink-0 w-72 group cursor-pointer">
                  <div className="relative aspect-video rounded-lg overflow-hidden mb-2">
                    <img src={workshop.thumbnail} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                      <Button size="sm" className="bg-white text-black hover:bg-white/90">
                        <Play className="w-4 h-4 mr-2" /> Watch Now
                      </Button>
                    </div>
                    <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
                      {workshop.duration}
                    </div>
                  </div>
                  <h5 className="font-medium text-slate-900">{workshop.title}</h5>
                  <p className="text-sm text-slate-500">{workshop.instructor}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Option D: Magazine/Editorial Style
  const OptionD = () => (
    <div className="space-y-12">
      {/* Editorial Hero */}
      <div className="grid grid-cols-2 gap-8">
        <div className="relative rounded-2xl overflow-hidden h-[500px]">
          <img src={sampleUpcoming[0].thumbnail} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-8">
            <span className="text-yellow-400 font-semibold text-sm tracking-wider uppercase mb-2 block">Featured Workshop</span>
            <h2 className="text-4xl font-bold text-white mb-4 leading-tight">{sampleUpcoming[0].title}</h2>
            <p className="text-white/70 mb-4">{sampleUpcoming[0].description}</p>
            <div className="flex items-center gap-4 text-white/60 text-sm">
              <span>{sampleUpcoming[0].instructor}</span>
              <span>·</span>
              <span>{formatDate(sampleUpcoming[0].date)}</span>
              <span>·</span>
              <span>{sampleUpcoming[0].time} IST</span>
            </div>
          </div>
        </div>
        
        <div className="space-y-4">
          {sampleUpcoming.slice(1).map((workshop, idx) => (
            <div key={workshop.id} className={`relative rounded-xl overflow-hidden ${idx === 0 ? 'h-60' : 'h-56'}`}>
              <img src={workshop.thumbnail} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-transparent" />
              <div className="absolute inset-0 p-6 flex flex-col justify-end">
                <h3 className="text-xl font-bold text-white mb-2">{workshop.title}</h3>
                <p className="text-white/60 text-sm">{workshop.instructor} · {formatDate(workshop.date)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Masonry Grid for Past */}
      <div>
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-2xl font-bold text-slate-900">Workshop Archive</h3>
          <Button variant="outline">Browse All <ArrowRight className="w-4 h-4 ml-2" /></Button>
        </div>
        
        <div className="grid grid-cols-4 gap-4">
          {samplePast.map((workshop, idx) => (
            <div 
              key={workshop.id} 
              className={`relative rounded-xl overflow-hidden group cursor-pointer ${
                idx === 0 ? 'col-span-2 row-span-2' : ''
              }`}
              style={{ height: idx === 0 ? '400px' : '190px' }}
            >
              <img src={workshop.thumbnail} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <h4 className={`font-bold text-white ${idx === 0 ? 'text-xl' : 'text-sm'}`}>{workshop.title}</h4>
                <div className="flex items-center gap-2 text-white/60 text-xs mt-1">
                  <span>{workshop.instructor}</span>
                  <span>·</span>
                  <span>{workshop.duration}</span>
                </div>
              </div>
              <div className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Play className="w-4 h-4 text-white ml-0.5" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Option E: Minimal & Clean
  const OptionE = () => (
    <div className="max-w-4xl mx-auto space-y-16">
      {/* Clean Header */}
      <div className="text-center">
        <h1 className="text-3xl font-light text-slate-900 mb-2">Workshops</h1>
        <p className="text-slate-500">Interactive learning sessions with industry experts</p>
      </div>

      {/* Upcoming - Single Column */}
      <div>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-6">Upcoming Sessions</h2>
        <div className="space-y-6">
          {sampleUpcoming.map((workshop) => (
            <div key={workshop.id} className="flex gap-8 py-6 border-b border-slate-100">
              <div className="w-48 h-32 rounded-lg overflow-hidden flex-shrink-0">
                <img src={workshop.thumbnail} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 text-sm text-slate-500 mb-2">
                  <span>{formatDate(workshop.date)}</span>
                  <span className="w-1 h-1 rounded-full bg-slate-300" />
                  <span>{workshop.time} IST</span>
                  <span className="w-1 h-1 rounded-full bg-slate-300" />
                  <span>{workshop.duration}</span>
                </div>
                <h3 className="text-xl font-medium text-slate-900 mb-2">{workshop.title}</h3>
                <p className="text-slate-500 mb-4">{workshop.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">{workshop.instructor}, {workshop.instructor_title}</span>
                  <Button variant={workshop.is_registered ? 'outline' : 'default'} size="sm">
                    {workshop.is_registered ? '✓ Registered' : 'Register'}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Past - Simple Grid */}
      <div>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-6">Recordings</h2>
        <div className="grid grid-cols-2 gap-8">
          {samplePast.map((workshop) => (
            <div key={workshop.id} className="group cursor-pointer">
              <div className="relative aspect-video rounded-lg overflow-hidden mb-4 bg-slate-100">
                <img src={workshop.thumbnail} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
                  <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                    <Play className="w-5 h-5 text-slate-900 ml-0.5" />
                  </div>
                </div>
                <span className="absolute bottom-3 right-3 text-xs text-white bg-black/60 px-2 py-1 rounded">
                  {workshop.duration}
                </span>
              </div>
              <h4 className="font-medium text-slate-900 mb-1">{workshop.title}</h4>
              <p className="text-sm text-slate-500">{workshop.instructor}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation */}
      <div className="sticky top-0 z-50 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-slate-900">Workshop Page Design Options</h1>
            <div className="flex gap-2">
              {['A', 'B', 'C', 'D', 'E'].map((option) => (
                <button
                  key={option}
                  onClick={() => setActiveOption(option)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeOption === option
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Option {option}
                </button>
              ))}
            </div>
          </div>
          <p className="text-sm text-slate-500 mt-2">
            {activeOption === 'A' && 'Modern Card Grid with Hero Section - Feature prominent hero, horizontal scroll cards, clean grid'}
            {activeOption === 'B' && 'Split Panel Design - List on left, detailed view on right, focused layout'}
            {activeOption === 'C' && 'Timeline + Gallery Hybrid - Visual timeline for upcoming, Netflix-style for recordings'}
            {activeOption === 'D' && 'Magazine/Editorial Style - Bold imagery, varied layouts, editorial feel'}
            {activeOption === 'E' && 'Minimal & Clean - Maximum whitespace, simple typography, elegant'}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-8 py-8">
        {activeOption === 'A' && <OptionA />}
        {activeOption === 'B' && <OptionB />}
        {activeOption === 'C' && <OptionC />}
        {activeOption === 'D' && <OptionD />}
        {activeOption === 'E' && <OptionE />}
      </div>
    </div>
  );
};

export default WorkshopDesignMockups;
