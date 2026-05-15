import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Calendar, Clock, User, Eye, BookOpen } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Blog card for grid
const BlogCardGrid = ({ post }) => (
  <Link
    to={`/blog/${post.slug}`}
    className="group bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-xl hover:border-blue-100 transition-all duration-300"
  >
    <div className="aspect-[16/10] overflow-hidden bg-gray-100">
      {post.thumbnail_url ? (
        <img
          src={post.thumbnail_url.startsWith('/') ? `${BACKEND_URL}${post.thumbnail_url}` : post.thumbnail_url}
          alt={post.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--gn-periwinkle-lighter) 0%, var(--gn-periwinkle-light) 100%)' }}>
          <BookOpen className="w-12 h-12" style={{ color: 'var(--gn-rhino)' }} />
        </div>
      )}
    </div>
    <div className="p-6">
      {post.category_name && (
        <span
          className="inline-block px-3 py-1 rounded-full text-xs font-medium mb-3"
          style={{ backgroundColor: `${post.category_color || '#2E3558'}15`, color: post.category_color || 'var(--gn-rhino)' }}
        >
          {post.category_name}
        </span>
      )}
      <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-[var(--gn-rhino-light)] transition-colors">
        {post.title}
      </h3>
      <p className="text-gray-600 text-sm line-clamp-2 mb-4">
        {post.excerpt}
      </p>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {post.reading_time_minutes || 5} min read
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {new Date(post.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>
      </div>
    </div>
  </Link>
);

// Featured post for Magazine design
const FeaturedPost = ({ post }) => (
  <Link
    to={`/blog/${post.slug}`}
    className="group relative h-[500px] rounded-3xl overflow-hidden"
  >
    <div className="absolute inset-0" style={{ backgroundColor: 'var(--gn-rhino)' }}>
      {post.thumbnail_url ? (
        <img
          src={post.thumbnail_url.startsWith('/') ? `${BACKEND_URL}${post.thumbnail_url}` : post.thumbnail_url}
          alt={post.title}
          className="w-full h-full object-cover opacity-60 group-hover:scale-105 group-hover:opacity-50 transition-all duration-700"
        />
      ) : (
        <div className="w-full h-full" style={{ background: 'linear-gradient(135deg, var(--gn-rhino) 0%, var(--gn-rhino-medium) 100%)' }} />
      )}
    </div>
    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
    <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12">
      <div className="flex items-center gap-3 mb-4">
        {post.category_name && (
          <span className="bg-white/20 text-white px-3 py-1 rounded-full text-sm">
            {post.category_name}
          </span>
        )}
      </div>
      <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 max-w-3xl">
        {post.title}
      </h2>
      <p className="text-white/80 text-lg mb-6 max-w-2xl line-clamp-2">
        {post.excerpt}
      </p>
      <div className="flex items-center gap-6 text-white/70 text-sm">
        <span className="flex items-center gap-2">
          <User className="w-4 h-4" />
          {post.author_name || 'GradNext Team'}
        </span>
        <span className="flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          {new Date(post.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </span>
        <span className="flex items-center gap-2">
          <Clock className="w-4 h-4" />
          {post.reading_time_minutes || 5} min read
        </span>
      </div>
    </div>
  </Link>
);

// Small card for sidebar
const SidebarSmallCard = ({ post }) => (
  <Link
    to={`/blog/${post.slug}`}
    className="group flex gap-4 p-4 bg-white rounded-xl border border-gray-100 hover:border-blue-100 hover:shadow-md transition-all"
  >
    <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
      {post.thumbnail_url ? (
        <img
          src={post.thumbnail_url.startsWith('/') ? `${BACKEND_URL}${post.thumbnail_url}` : post.thumbnail_url}
          alt={post.title}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--gn-periwinkle-lighter) 0%, var(--gn-periwinkle-light) 100%)' }}>
          <BookOpen className="w-6 h-6" style={{ color: 'var(--gn-rhino)' }} />
        </div>
      )}
    </div>
    <div className="flex-1 min-w-0">
      <span
        className="inline-block px-2 py-0.5 rounded text-xs font-medium mb-1"
        style={{ backgroundColor: `${post.category_color || '#2E3558'}15`, color: post.category_color || 'var(--gn-rhino)' }}
      >
        {post.category_name}
      </span>
      <h4 className="font-semibold text-gray-900 line-clamp-2 group-hover:text-[var(--gn-rhino-light)] transition-colors text-sm">
        {post.title}
      </h4>
      <p className="text-xs text-gray-500 mt-1">
        {post.reading_time_minutes || 5} min read
      </p>
    </div>
  </Link>
);

// Main Blog Page Component
const BlogPage = () => {
  const [searchParams] = useSearchParams();
  const [posts, setPosts] = useState([]);
  const [featuredPosts, setFeaturedPosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const selectedCategory = searchParams.get('category');
  const selectedTag = searchParams.get('tag');

  useEffect(() => {
    fetchData();
  }, [selectedCategory, selectedTag]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory) params.append('category', selectedCategory);
      if (selectedTag) params.append('tag', selectedTag);
      
      const [postsRes, featuredRes, categoriesRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/blog/posts?${params.toString()}`),
        axios.get(`${BACKEND_URL}/api/blog/posts/featured`),
        axios.get(`${BACKEND_URL}/api/blog/categories`)
      ]);

      setPosts(postsRes.data.posts || []);
      setFeaturedPosts(featuredRes.data.posts || []);
      // Filter categories to only show those with posts
      setCategories((categoriesRes.data.categories || []).filter(cat => cat.post_count > 0));
    } catch (error) {
      console.error('Error fetching blog data:', error);
    }
    setLoading(false);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    // Implement search
  };

  // Demo posts for when there are no real posts
  const demoPosts = [
    {
      id: '1',
      slug: 'how-to-ace-mckinsey-case-interview',
      title: 'How to Ace Your McKinsey Case Interview: A Complete Guide',
      excerpt: 'Master the McKinsey Problem Solving Interview with our comprehensive guide covering frameworks, practice tips, and insider strategies.',
      category_name: 'Case Interview',
      category_slug: 'case-interview',
      category_color: '#3B82F6',
      author_name: 'Rahul Sharma',
      author_image: null,
      thumbnail_url: null,
      published_at: '2025-04-01T10:00:00Z',
      reading_time_minutes: 12,
      is_featured: true
    },
    {
      id: '2',
      slug: 'from-iim-to-bcg-journey',
      title: 'From IIM to BCG: My Journey to Management Consulting',
      excerpt: 'A first-hand account of preparing for and landing a consulting role at BCG straight out of business school.',
      category_name: 'Success Stories',
      category_slug: 'success-stories',
      category_color: '#F59E0B',
      author_name: 'Priya Mehta',
      thumbnail_url: null,
      published_at: '2025-03-28T10:00:00Z',
      reading_time_minutes: 8,
      is_featured: true
    },
    {
      id: '3',
      slug: 'top-5-frameworks-consulting',
      title: 'Top 5 Frameworks Every Consulting Aspirant Must Know',
      excerpt: 'Essential frameworks including profitability, market entry, M&A, and more that will help you structure any case.',
      category_name: 'Consulting Tips',
      category_slug: 'consulting-tips',
      category_color: '#10B981',
      author_name: 'GradNext Team',
      thumbnail_url: null,
      published_at: '2025-03-25T10:00:00Z',
      reading_time_minutes: 10,
      is_featured: false
    },
    {
      id: '4',
      slug: 'bain-vs-bcg-culture',
      title: 'Bain vs BCG: Comparing Culture, Work Style, and Growth',
      excerpt: 'An in-depth comparison of two top consulting firms to help you decide which one aligns with your career goals.',
      category_name: 'Industry Insights',
      category_slug: 'industry-insights',
      category_color: '#EC4899',
      author_name: 'GradNext Team',
      thumbnail_url: null,
      published_at: '2025-03-20T10:00:00Z',
      reading_time_minutes: 15,
      is_featured: false
    },
    {
      id: '5',
      slug: 'gradnext-launches-peer-practice',
      title: 'GradNext Launches AI-Powered Peer Practice Platform',
      excerpt: 'Announcing our new feature that matches you with the perfect case partner and provides AI-driven feedback.',
      category_name: 'Company News',
      category_slug: 'company-news',
      category_color: '#8B5CF6',
      author_name: 'GradNext Team',
      thumbnail_url: null,
      published_at: '2025-03-15T10:00:00Z',
      reading_time_minutes: 5,
      is_featured: false
    },
    {
      id: '6',
      slug: 'mental-math-tips',
      title: '10 Mental Math Tips for Consulting Interviews',
      excerpt: 'Quick calculation techniques that will help you breeze through quantitative questions in case interviews.',
      category_name: 'Case Interview',
      category_slug: 'case-interview',
      category_color: '#3B82F6',
      author_name: 'GradNext Team',
      thumbnail_url: null,
      published_at: '2025-03-10T10:00:00Z',
      reading_time_minutes: 7,
      is_featured: false
    }
  ];

  const displayPosts = posts.length > 0 ? posts : demoPosts;
  const displayFeatured = featuredPosts.length > 0 ? featuredPosts : demoPosts.filter(p => p.is_featured);
  
  // For demo, show all categories if none have posts
  const displayCategories = categories.length > 0 ? categories : [
    { id: 'cat-case-interview', name: 'Case Interview', slug: 'case-interview', color: '#3B82F6' },
    { id: 'cat-consulting-tips', name: 'Consulting Tips', slug: 'consulting-tips', color: '#10B981' },
    { id: 'cat-success-stories', name: 'Success Stories', slug: 'success-stories', color: '#F59E0B' },
    { id: 'cat-company-news', name: 'Company News', slug: 'company-news', color: '#8B5CF6' },
    { id: 'cat-industry-insights', name: 'Industry Insights', slug: 'industry-insights', color: '#EC4899' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section - Similar to Landing Page */}
      <section className="hero-section pt-24 sm:pt-32 pb-12 overflow-hidden relative">
        {/* Concentric Circles Background */}
        <div className="hero-concentric">
          <div className="hero-center-glow" />
          <div className="hero-circle hero-circle-1" />
          <div className="hero-circle hero-circle-2" />
          <div className="hero-circle hero-circle-3" />
          <div className="hero-circle hero-circle-4" />
          <div className="hero-circle hero-circle-5" />
          <div className="hero-circle hero-circle-6" />
          <div className="hero-circle hero-circle-7" />
          <div className="hero-circle hero-circle-8" />
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <div className="badge-primary mb-4 sm:mb-6 animate-fade-in inline-flex mx-auto text-sm sm:text-base">
              <span className="w-2 h-2 rounded-full animate-pulse-dot" style={{ backgroundColor: 'var(--gn-chrome-yellow)' }} />
              <span>Insights from MBB Consultants</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 animate-fade-in-up" style={{ color: 'var(--gn-rhino)' }}>
              Blogs
            </h1>

            {/* Subheadline */}
            <div className="mb-6 sm:mb-8 animate-fade-in-up stagger-1 max-w-2xl mx-auto px-4 sm:px-0">
              <p className="text-lg sm:text-xl" style={{ color: 'var(--gn-grey-dark)' }}>
                Expert tips, success stories, and insights to help you crack your consulting interview
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Bar */}
      <div className="bg-white border-b border-gray-100 sticky top-16 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-3 overflow-x-auto pb-2">
            <Link
              to="/blog"
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                !selectedCategory 
                  ? 'text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              style={!selectedCategory ? { backgroundColor: 'var(--gn-rhino)' } : {}}
            >
              All Posts
            </Link>
            {displayCategories.map((cat) => (
              <Link
                key={cat.id}
                to={`/blog?category=${cat.slug}`}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === cat.slug
                    ? 'text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                style={selectedCategory === cat.slug ? { backgroundColor: 'var(--gn-rhino)' } : {}}
              >
                {cat.name}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: 'var(--gn-rhino)' }}></div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Featured Post */}
            {displayFeatured[0] && (
              <FeaturedPost post={displayFeatured[0]} />
            )}

            {/* First Row: 2 Cards + Trending Sidebar */}
            <div>
              <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--gn-rhino)' }}>Latest Articles</h2>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* First 2 cards */}
                {displayPosts.slice(0, 2).map((post) => (
                  <BlogCardGrid key={post.id} post={post} />
                ))}

                {/* Trending Sidebar - matches card height */}
                <div className="bg-white rounded-xl p-6 border border-gray-100 h-full">
                  <h3 className="font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--gn-rhino)' }}>
                    <Eye className="w-5 h-5" />
                    Trending
                  </h3>
                  <div className="space-y-3">
                    {displayPosts.slice(0, 3).map((post) => (
                      <SidebarSmallCard key={post.id} post={post} />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Second Row: 3 Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {displayPosts.slice(2, 5).map((post) => (
                <BlogCardGrid key={post.id} post={post} />
              ))}
            </div>
          </div>
        )}
      </main>

      {/* CTA Section */}
      <section className="py-16" style={{ backgroundColor: 'var(--gn-rhino)' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Crack Your Consulting Interview?
          </h2>
          <p className="text-lg mb-8 max-w-2xl mx-auto" style={{ color: 'var(--gn-periwinkle-light)' }}>
            Join thousands of candidates who have successfully landed roles at McKinsey, BCG, and Bain with GradNext.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register">
              <Button 
                size="lg" 
                className="font-semibold px-8"
                style={{ backgroundColor: 'var(--gn-chrome-yellow)', color: 'var(--gn-black)' }}
              >
                Start Free Trial
              </Button>
            </Link>
            <Link to="/pricing">
              <Button 
                size="lg" 
                variant="outline" 
                className="border-white text-white hover:bg-white/10 px-8"
              >
                View Pricing
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default BlogPage;
