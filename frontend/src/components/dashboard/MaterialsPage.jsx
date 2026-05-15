import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useDashboard } from './DashboardLayout';
import { BookOpen, FileText, Eye, FolderOpen, Briefcase, FileSpreadsheet, Search, X, ExternalLink, Download } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const MaterialsPage = () => {
  const { dashboardData } = useDashboard();
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  useEffect(() => {
    const fetchMaterials = async () => {
      try {
        const response = await axios.get(`${BACKEND_URL}/api/resources/materials`, {
          withCredentials: true,
        });
        setMaterials(response.data);
      } catch (error) {
        console.error('Failed to fetch materials:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMaterials();
  }, []);

  const handleViewMaterial = (material) => {
    setSelectedMaterial(material);
    setIsViewerOpen(true);
  };

  const categories = ['all', ...new Set(materials.map(m => m.category))];

  const filteredMaterials = materials.filter(material => {
    if (selectedCategory !== 'all' && material.category !== selectedCategory) return false;
    if (searchQuery && !material.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'Casebook': return <BookOpen className="w-5 h-5" />;
      case 'Template': return <FileText className="w-5 h-5" />;
      case 'Industry Primer': return <FolderOpen className="w-5 h-5" />;
      case 'Guide': return <Briefcase className="w-5 h-5" />;
      default: return <FileSpreadsheet className="w-5 h-5" />;
    }
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case 'Casebook': return 'bg-blue-50 text-blue-600';
      case 'Template': return 'bg-emerald-50 text-emerald-600';
      case 'Industry Primer': return 'bg-violet-50 text-violet-600';
      case 'Guide': return 'bg-amber-50 text-amber-600';
      default: return 'bg-slate-50 text-slate-600';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Case Interview Materials</h1>
        <p className="text-slate-500">Access our complete library of casebooks, templates, and guides</p>
      </div>

      {/* Info Banner */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
        <p className="text-emerald-800">
          <span className="font-semibold">Good news!</span> Case interview materials are free for all users.
        </p>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Search materials..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCategory === category
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              {category === 'all' ? 'All' : category}
            </button>
          ))}
        </div>
      </div>

      {/* Materials Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredMaterials.map((material) => (
          <div
            key={material.id}
            className="bg-white rounded-xl p-5 border border-slate-100 hover:shadow-md hover:border-blue-200 transition-all"
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getCategoryColor(material.category)}`}>
                {getCategoryIcon(material.category)}
              </div>
              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded">
                {material.category}
              </span>
            </div>

            <h3 className="font-semibold text-slate-900 mb-1">{material.title}</h3>
            <p className="text-sm text-slate-500 mb-4">{material.description}</p>

            <Button 
              variant="outline" 
              className="w-full group"
              onClick={() => handleViewMaterial(material)}
            >
              <Eye className="w-4 h-4 mr-2 group-hover:text-blue-600" />
              View
            </Button>
          </div>
        ))}
      </div>

      {filteredMaterials.length === 0 && (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No materials found matching your criteria</p>
        </div>
      )}

      {/* Material Viewer Modal */}
      <Dialog open={isViewerOpen} onOpenChange={setIsViewerOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedMaterial && getCategoryIcon(selectedMaterial.category)}
              {selectedMaterial?.title}
            </DialogTitle>
          </DialogHeader>
          
          {selectedMaterial?.file_url ? (
            <div className="space-y-4">
              {/* PDF Viewer */}
              <div className="bg-slate-100 rounded-lg overflow-hidden" style={{ height: '60vh' }}>
                <iframe
                  src={`${selectedMaterial.file_url}#toolbar=1&navpanes=0`}
                  title={selectedMaterial.title}
                  className="w-full h-full border-0"
                  style={{ minHeight: '500px' }}
                />
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => window.open(selectedMaterial.file_url, '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open in New Tab
                </Button>
                <Button 
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = selectedMaterial.file_url;
                    link.download = selectedMaterial.title + '.pdf';
                    link.click();
                  }}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">
              <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>No file available for this material.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MaterialsPage;