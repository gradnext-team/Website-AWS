import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Calendar, Clock, User, ArrowLeft, Tag, Share2, Linkedin, Twitter, Facebook, BookOpen } from 'lucide-react';
import { Button } from '../components/ui/button';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Related post card
const RelatedPostCard = ({ post }) => (
  <Link
    to={`/blog/${post.slug}`}
    className="group bg-white rounded-xl overflow-hidden border border-gray-100 hover:border-blue-100 hover:shadow-lg transition-all"
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
          <BookOpen className="w-10 h-10" style={{ color: 'var(--gn-rhino)' }} />
        </div>
      )}
    </div>
    <div className="p-5">
      <span
        className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium mb-2"
        style={{ backgroundColor: `${post.category_color || '#2E3558'}15`, color: post.category_color || 'var(--gn-rhino)' }}
      >
        {post.category_name}
      </span>
      <h4 className="font-semibold text-gray-900 line-clamp-2 group-hover:text-[var(--gn-rhino-light)] transition-colors">
        {post.title}
      </h4>
      <p className="text-sm text-gray-500 mt-2">
        {post.reading_time_minutes || 5} min read
      </p>
    </div>
  </Link>
);

// Share buttons
const ShareButtons = ({ title, url }) => {
  const shareUrl = encodeURIComponent(url);
  const shareTitle = encodeURIComponent(title);

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-500 flex items-center gap-2">
        <Share2 className="w-4 h-4" />
        Share:
      </span>
      <a
        href={`https://www.linkedin.com/shareArticle?mini=true&url=${shareUrl}&title=${shareTitle}`}
        target="_blank"
        rel="noopener noreferrer"
        className="w-9 h-9 flex items-center justify-center rounded-full transition-colors"
        style={{ backgroundColor: 'var(--gn-periwinkle-lighter)', color: 'var(--gn-rhino)' }}
        onMouseEnter={(e) => { e.target.style.backgroundColor = 'var(--gn-rhino)'; e.target.style.color = 'white'; }}
        onMouseLeave={(e) => { e.target.style.backgroundColor = 'var(--gn-periwinkle-lighter)'; e.target.style.color = 'var(--gn-rhino)'; }}
      >
        <Linkedin className="w-4 h-4" />
      </a>
      <a
        href={`https://twitter.com/intent/tweet?url=${shareUrl}&text=${shareTitle}`}
        target="_blank"
        rel="noopener noreferrer"
        className="w-9 h-9 flex items-center justify-center rounded-full transition-colors"
        style={{ backgroundColor: 'var(--gn-periwinkle-lighter)', color: 'var(--gn-rhino)' }}
        onMouseEnter={(e) => { e.target.style.backgroundColor = 'var(--gn-rhino)'; e.target.style.color = 'white'; }}
        onMouseLeave={(e) => { e.target.style.backgroundColor = 'var(--gn-periwinkle-lighter)'; e.target.style.color = 'var(--gn-rhino)'; }}
      >
        <Twitter className="w-4 h-4" />
      </a>
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className="w-9 h-9 flex items-center justify-center rounded-full transition-colors"
        style={{ backgroundColor: 'var(--gn-periwinkle-lighter)', color: 'var(--gn-rhino)' }}
        onMouseEnter={(e) => { e.target.style.backgroundColor = 'var(--gn-rhino)'; e.target.style.color = 'white'; }}
        onMouseLeave={(e) => { e.target.style.backgroundColor = 'var(--gn-periwinkle-lighter)'; e.target.style.color = 'var(--gn-rhino)'; }}
      >
        <Facebook className="w-4 h-4" />
      </a>
    </div>
  );
};

const BlogPostPage = () => {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPost();
  }, [slug]);

  const fetchPost = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${BACKEND_URL}/api/blog/posts/${slug}`);
      setPost(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Post not found');
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-24 sm:pt-28 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: 'var(--gn-rhino)' }}></div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-gray-50 pt-24 sm:pt-28 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--gn-rhino)' }}>Post Not Found</h2>
          <p className="text-gray-600 mb-6">{error || 'The article you\'re looking for doesn\'t exist.'}</p>
          <Link to="/blog">
            <Button className="btn-primary">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Blog
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const currentUrl = window.location.href;

  return (
    <div className="min-h-screen bg-gray-50 pt-24 sm:pt-28">
      {/* Hero Section */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-[var(--gn-rhino-light)] transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Blog
          </Link>

          <div className="flex items-center gap-3 mb-4">
            <span
              className="inline-block px-3 py-1 rounded-full text-sm font-medium"
              style={{ backgroundColor: `${post.category_color || '#2E3558'}15`, color: post.category_color || 'var(--gn-rhino)' }}
            >
              {post.category_name}
            </span>
          </div>

          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 leading-tight" style={{ color: 'var(--gn-rhino)' }}>
            {post.title}
          </h1>

          <p className="text-xl text-gray-600 mb-8">
            {post.excerpt}
          </p>

          <div className="flex flex-wrap items-center justify-between gap-4 pb-8 border-b border-gray-100">
            <div className="flex items-center gap-4">
              {post.author_image ? (
                <img
                  src={post.author_image}
                  alt={post.author_name}
                  className="w-12 h-12 rounded-full"
                />
              ) : (
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold"
                  style={{ background: 'linear-gradient(135deg, var(--gn-rhino) 0%, var(--gn-rhino-medium) 100%)' }}
                >
                  {(post.author_name || 'G')[0]}
                </div>
              )}
              <div>
                <p className="font-semibold" style={{ color: 'var(--gn-rhino)' }}>{post.author_name || 'GradNext Team'}</p>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {new Date(post.published_at).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {post.reading_time_minutes || 5} min read
                  </span>
                </div>
              </div>
            </div>

            <ShareButtons title={post.title} url={currentUrl} />
          </div>
        </div>
      </header>

      {/* Featured Image */}
      {post.thumbnail_url && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-4 mb-12">
          <div className="aspect-[2/1] rounded-2xl overflow-hidden shadow-lg">
            <img
              src={post.thumbnail_url.startsWith('/') ? `${BACKEND_URL}${post.thumbnail_url}` : post.thumbnail_url}
              alt={post.title}
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      )}

      {/* Content */}
      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div
          className="prose prose-lg max-w-none
            prose-headings:font-bold prose-headings:text-[var(--gn-rhino)]
            prose-p:text-gray-700 prose-p:leading-relaxed
            prose-a:text-[var(--gn-rhino-light)] prose-a:no-underline hover:prose-a:underline
            prose-img:rounded-xl prose-img:shadow-lg
            prose-blockquote:border-[var(--gn-chrome-yellow)] prose-blockquote:bg-[var(--gn-chrome-lightest)] prose-blockquote:py-1 prose-blockquote:px-6 prose-blockquote:rounded-r-lg
            prose-code:bg-gray-100 prose-code:px-2 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
            prose-pre:bg-[var(--gn-rhino)] prose-pre:text-gray-100"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="mt-12 pt-8 border-t border-gray-100">
            <div className="flex items-center gap-3 flex-wrap">
              <Tag className="w-5 h-5 text-gray-400" />
              {post.tags.map((tag) => (
                <Link
                  key={tag}
                  to={`/blog?tag=${tag}`}
                  className="px-4 py-2 bg-gray-100 hover:bg-[var(--gn-periwinkle-lighter)] hover:text-[var(--gn-rhino)] rounded-full text-sm text-gray-700 transition-colors"
                >
                  {tag}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Author Bio */}
        {post.author_bio && (
          <div className="mt-12 p-6 rounded-2xl" style={{ backgroundColor: 'var(--gn-periwinkle-lighter)' }}>
            <div className="flex items-start gap-4">
              {post.author_image ? (
                <img
                  src={post.author_image}
                  alt={post.author_name}
                  className="w-16 h-16 rounded-full"
                />
              ) : (
                <div 
                  className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold"
                  style={{ background: 'linear-gradient(135deg, var(--gn-rhino) 0%, var(--gn-rhino-medium) 100%)' }}
                >
                  {(post.author_name || 'G')[0]}
                </div>
              )}
              <div>
                <h4 className="font-bold" style={{ color: 'var(--gn-rhino)' }}>About {post.author_name}</h4>
                <p className="text-gray-600 mt-1">{post.author_bio}</p>
              </div>
            </div>
          </div>
        )}

        {/* Share */}
        <div className="mt-12 pt-8 border-t border-gray-100 flex items-center justify-between">
          <p className="text-gray-600">Found this helpful? Share it with others!</p>
          <ShareButtons title={post.title} url={currentUrl} />
        </div>
      </article>

      {/* Related Posts */}
      {post.related_posts && post.related_posts.length > 0 && (
        <section className="bg-white border-t border-gray-100 py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold mb-8" style={{ color: 'var(--gn-rhino)' }}>Related Articles</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {post.related_posts.map((relatedPost) => (
                <RelatedPostCard key={relatedPost.id} post={relatedPost} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
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
            <Link to="/blog">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 px-8">
                Browse More Articles
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default BlogPostPage;
