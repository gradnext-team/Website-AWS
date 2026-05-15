import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Trophy, Plus, Edit2, Trash2, Save, X, Calendar, Clock,
  Users, HelpCircle, Loader2, ChevronDown, ChevronUp,
  FileText, AlertCircle, CheckCircle2, Target, Download, Eye, EyeOff
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Sample questions to seed
const SAMPLE_QUESTIONS = [
  // Case Math - Hard
  { question: "A PE firm buys a company for $240M (8x EBITDA of $30M) using $150M debt. After 5 years, EBITDA grows to $45M and they exit at 7x. Debt is paid down to $100M. What's the equity value at exit?", question_type: "text_input", correct_answer: "$215M", acceptable_answers: ["$215M", "215M", "$215 million", "215"], category: "case_math", difficulty: "hard", explanation: "Exit value = $45M × 7x = $315M. Equity at exit = $315M - $100M debt = $215M" },
  { question: "A SaaS company has 30% revenue growth and 20% EBITDA margin. Using the Rule of 40 (Growth + Margin ≥ 40%), what is their score?", question_type: "multiple_choice", options: ["35 - Below Rule of 40", "50 - Exceeds Rule of 40", "40 - Meets Rule of 40", "25 - Below Rule of 40"], correct_answer: "50 - Exceeds Rule of 40", category: "case_math", difficulty: "hard", explanation: "Rule of 40 score = 30% + 20% = 50%. Score > 40 indicates healthy unit economics" },
  { question: "Your client has $100M revenue. They can either: A) Cut costs by 10% (costs are $80M), or B) Increase prices by 5% with 8% volume loss. Which creates more profit improvement?", question_type: "multiple_choice", options: ["A: $8M improvement", "B: $3.2M improvement", "Both equal at $5M", "B: $8M improvement"], correct_answer: "A: $8M improvement", category: "case_math", difficulty: "hard", explanation: "Current profit = $20M. Option A: Costs become $72M, profit = $28M (+$8M). Option B: Revenue = $96.6M with proportional cost reduction gives less improvement." },
  { question: "A subscription company has $100 monthly ARPU and 10% monthly churn. CAC is $200. What's the LTV:CAC ratio?", question_type: "multiple_choice", options: ["4.0x", "5.0x", "6.0x", "3.0x"], correct_answer: "5.0x", category: "case_math", difficulty: "medium", explanation: "LTV = Monthly ARPU / Monthly Churn = $100 / 10% = $1,000. LTV:CAC = $1,000 / $200 = 5.0x" },
  { question: "Working capital cycle: 45 days inventory + 30 days receivables - 40 days payables. What is the cash conversion cycle?", question_type: "multiple_choice", options: ["25 days", "30 days", "35 days", "40 days"], correct_answer: "35 days", category: "case_math", difficulty: "medium", explanation: "Cash cycle = 45 + 30 - 40 = 35 days" },
  
  // Guesstimates
  { question: "Estimate the number of tennis balls that can fit in this room (assume standard 15ft x 15ft x 10ft room)", question_type: "multiple_choice", options: ["~100,000", "~300,000", "~500,000", "~1,000,000"], correct_answer: "~300,000", category: "guesstimate", difficulty: "medium", explanation: "Room volume ≈ 2,250 cubic ft. Tennis ball diameter ≈ 2.7 inches. Accounting for ~65% packing efficiency, approximately 300,000 balls fit." },
  { question: "Estimate the annual revenue of a typical Starbucks store in a major US city", question_type: "multiple_choice", options: ["$500K - $800K", "$800K - $1.2M", "$1.2M - $1.8M", "$1.8M - $2.5M"], correct_answer: "$1.2M - $1.8M", category: "guesstimate", difficulty: "medium", explanation: "Typical urban Starbucks: ~500 customers/day × $6 avg ticket × 365 days = ~$1.1M. Adding peak times and food sales: $1.2-1.8M range." },
  { question: "How many gas stations are there in the United States?", question_type: "multiple_choice", options: ["~50,000", "~100,000", "~150,000", "~250,000"], correct_answer: "~150,000", category: "guesstimate", difficulty: "hard", explanation: "330M population, ~275M registered vehicles. If each station serves ~2,000 cars regularly, need ~137,000 stations. Reality is ~150,000." },
  
  // Structuring
  { question: "A retail CEO asks: 'Should we enter the e-commerce market?' What is the MOST important factor to analyze first?", question_type: "multiple_choice", options: ["Competitor landscape", "Customer willingness to buy online", "Implementation costs", "Current profit margins"], correct_answer: "Customer willingness to buy online", category: "structuring", difficulty: "medium", explanation: "Market demand validation should come first - without customers willing to buy online, all other factors become irrelevant." },
  { question: "When structuring a market entry case, which framework element is LEAST likely to provide actionable insights?", question_type: "multiple_choice", options: ["Market size and growth", "Competitive dynamics", "General PESTEL analysis", "Customer segments and needs"], correct_answer: "General PESTEL analysis", category: "structuring", difficulty: "medium", explanation: "PESTEL is too broad for most market entry cases. Focused analysis of market, competition, and customers provides more actionable insights." },
  { question: "A private equity firm is evaluating a healthcare services acquisition. What's the correct order of analysis priority?", question_type: "multiple_choice", options: ["Synergies → Market → Financials", "Market → Financials → Synergies", "Financials → Synergies → Market", "Market → Synergies → Financials"], correct_answer: "Market → Financials → Synergies", category: "structuring", difficulty: "hard", explanation: "For PE: First validate market attractiveness, then financial health of target, finally synergy potential. Market fundamentals matter most." },
  
  // More Case Math
  { question: "Net Revenue Retention is 115%, Gross Retention is 90% on a $10M ARR cohort. What's the expansion revenue?", question_type: "multiple_choice", options: ["$1.5M", "$2.0M", "$2.5M", "$3.0M"], correct_answer: "$2.5M", category: "case_math", difficulty: "hard", explanation: "New ARR = $10M × 115% = $11.5M. Retained = $10M × 90% = $9M. Expansion = $11.5M - $9M = $2.5M" },
  { question: "Company has EV of $500M, Net Debt of $100M, and 20M shares outstanding. What is the implied share price?", question_type: "multiple_choice", options: ["$18", "$20", "$22", "$25"], correct_answer: "$20", category: "case_math", difficulty: "medium", explanation: "Equity Value = EV - Net Debt = $500M - $100M = $400M. Share price = $400M / 20M = $20" },
  { question: "Fixed costs are $120K, variable costs are $5/unit, price is $15/unit. What is the break-even quantity?", question_type: "multiple_choice", options: ["8,000 units", "10,000 units", "12,000 units", "15,000 units"], correct_answer: "12,000 units", category: "case_math", difficulty: "medium", explanation: "$120K / ($15 - $5) = $120K / $10 = 12,000 units" },
  { question: "A hotel has 100 rooms at $150/night. At 80% occupancy, what is monthly revenue?", question_type: "multiple_choice", options: ["$300,000", "$360,000", "$400,000", "$450,000"], correct_answer: "$360,000", category: "case_math", difficulty: "medium", explanation: "100 rooms × $150 × 80% × 30 days = $360,000" },
  { question: "Market size is $5B and company has 2% share. What is company revenue?", question_type: "text_input", correct_answer: "$100M", acceptable_answers: ["$100M", "100M", "$100 million", "100 million"], category: "case_math", difficulty: "easy", explanation: "$5B × 2% = $100 million" },
  { question: "Operating costs increased from $200K to $240K. What is the percentage increase?", question_type: "multiple_choice", options: ["10%", "15%", "20%", "25%"], correct_answer: "20%", category: "case_math", difficulty: "easy", explanation: "($240K - $200K) / $200K = $40K / $200K = 20%" },
  { question: "A startup has $2M funding and burns $100K/month. What is the runway?", question_type: "multiple_choice", options: ["15 months", "20 months", "25 months", "30 months"], correct_answer: "20 months", category: "case_math", difficulty: "easy", explanation: "$2,000,000 / $100,000 per month = 20 months runway" },
  { question: "Customer lifetime is 24 months, monthly value is $25. What is LTV?", question_type: "multiple_choice", options: ["$400", "$500", "$600", "$700"], correct_answer: "$600", category: "case_math", difficulty: "easy", explanation: "24 months × $25/month = $600" },
  
  // More Structuring
  { question: "Your client is a struggling airline. Which issue tree branch should you explore FIRST?", question_type: "multiple_choice", options: ["Cost reduction opportunities", "Revenue decline root causes", "Fleet optimization", "Staff productivity"], correct_answer: "Revenue decline root causes", category: "structuring", difficulty: "medium", explanation: "Always diagnose the root cause before jumping to solutions. Revenue decline could be from pricing, demand, or competition - each requires different solutions." },
  { question: "For a profitability case, what's the correct way to structure the analysis?", question_type: "multiple_choice", options: ["Profit = Revenue - Costs, then break down each", "Start with industry benchmarks", "Focus on cost cutting first", "Analyze competitors first"], correct_answer: "Profit = Revenue - Costs, then break down each", category: "structuring", difficulty: "easy", explanation: "The fundamental profit tree: Profit = Revenue - Costs. Then decompose: Revenue = Price × Volume, Costs = Fixed + Variable." },
  { question: "When analyzing a merger, what's typically NOT a primary source of synergies?", question_type: "multiple_choice", options: ["Revenue synergies from cross-selling", "Cost synergies from eliminating overlaps", "Brand value synergies", "Operational synergies from shared services"], correct_answer: "Brand value synergies", category: "structuring", difficulty: "medium", explanation: "Brand value is hard to quantify and realize. Revenue, cost, and operational synergies are the three primary categories in M&A analysis." },
  
  // More Guesstimates  
  { question: "Estimate the market size of the US pet food industry", question_type: "multiple_choice", options: ["$15-20 billion", "$30-40 billion", "$50-60 billion", "$70-80 billion"], correct_answer: "$30-40 billion", category: "guesstimate", difficulty: "medium", explanation: "~90M households with pets × ~$30-40/month on pet food × 12 = ~$32-43B. The actual market is ~$35B." },
  { question: "How many haircuts are given in New York City per day?", question_type: "multiple_choice", options: ["~50,000", "~100,000", "~200,000", "~400,000"], correct_answer: "~100,000", category: "guesstimate", difficulty: "medium", explanation: "NYC pop ~8.5M. Average person gets haircut every ~6 weeks. Daily haircuts = 8.5M / 42 days ≈ 200K. Adjust for commuters and tourists: ~100-150K." },
  
  // Advanced questions
  { question: "Using DCF: Perpetual FCF $20M, WACC 10%, terminal growth 2%. What is terminal value?", question_type: "multiple_choice", options: ["$200M", "$225M", "$250M", "$275M"], correct_answer: "$250M", category: "case_math", difficulty: "hard", explanation: "TV = FCF × (1+g) / (WACC - g) = $20M × 1.02 / (10% - 2%) = $20.4M / 8% ≈ $255M ≈ $250M" },
  { question: "Unlevered beta is 0.8, D/E ratio is 0.5, tax rate is 25%. What is levered beta?", question_type: "multiple_choice", options: ["0.9", "1.0", "1.1", "1.2"], correct_answer: "1.1", category: "case_math", difficulty: "hard", explanation: "Levered beta = Unlevered × (1 + D/E × (1-T)) = 0.8 × (1 + 0.5 × 0.75) = 0.8 × 1.375 = 1.1" },
  { question: "Cost of equity using CAPM: Risk-free rate 3%, Beta 1.2, Market risk premium 6%. What is cost of equity?", question_type: "text_input", correct_answer: "10.2%", acceptable_answers: ["10.2%", "10.2", "10%"], category: "case_math", difficulty: "hard", explanation: "CoE = Rf + Beta × MRP = 3% + 1.2 × 6% = 3% + 7.2% = 10.2%" },
  { question: "Gross margin is 45%, Operating margin is 15%. What is OpEx as percentage of revenue?", question_type: "multiple_choice", options: ["25%", "30%", "35%", "40%"], correct_answer: "30%", category: "case_math", difficulty: "medium", explanation: "OpEx = Gross margin - Operating margin = 45% - 15% = 30%" },
];

const CompetitionsSection = () => {
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showQuestionsModal, setShowQuestionsModal] = useState(false);
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCompetition, setSelectedCompetition] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [stats, setStats] = useState({});
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    rules: '',
    show_in_nav: true,
    window_start_date: '',
    window_start_time: '',
    window_end_date: '',
    window_end_time: '',
    quiz_duration_minutes: 10,
    questions_per_user: 10
  });
  
  useEffect(() => {
    fetchCompetitions();
  }, []);
  
  const fetchCompetitions = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/competitions/admin/competitions`, {
        withCredentials: true
      });
      setCompetitions(res.data.competitions || []);
      
      // Fetch stats for each competition
      for (const comp of res.data.competitions || []) {
        fetchStats(comp.id);
      }
    } catch (error) {
      console.error('Failed to fetch competitions:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchStats = async (competitionId) => {
    try {
      const res = await axios.get(
        `${BACKEND_URL}/api/competitions/admin/competitions/${competitionId}/stats`,
        { withCredentials: true }
      );
      setStats(prev => ({ ...prev, [competitionId]: res.data }));
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };
  
  const fetchParticipants = async (competitionId) => {
    setParticipantsLoading(true);
    try {
      const res = await axios.get(
        `${BACKEND_URL}/api/competitions/admin/competitions/${competitionId}/participants`,
        { withCredentials: true }
      );
      setParticipants(res.data.participants || []);
    } catch (error) {
      console.error('Failed to fetch participants:', error);
    } finally {
      setParticipantsLoading(false);
    }
  };
  
  const exportParticipants = async (competitionId) => {
    try {
      const response = await axios.get(
        `${BACKEND_URL}/api/competitions/admin/competitions/${competitionId}/participants/export`,
        { 
          withCredentials: true,
          responseType: 'blob'
        }
      );
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      // Get filename from response headers or generate one
      const contentDisposition = response.headers['content-disposition'];
      let filename = 'participants.xlsx';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename=(.+)/);
        if (match) filename = match[1];
      }
      
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export participants:', error);
      alert('Failed to export participants data');
    }
  };
  
  const openParticipantsModal = (competition) => {
    setSelectedCompetition(competition);
    setShowParticipantsModal(true);
    fetchParticipants(competition.id);
  };
  
  const openEditModal = (competition) => {
    setSelectedCompetition(competition);
    // Format dates for separate date and time inputs
    const formatDateForInput = (dateStr) => {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    const formatTimeForInput = (dateStr) => {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    };
    
    // Use new window fields if available, fallback to legacy fields
    const windowStart = competition.window_start || competition.quiz_start_time;
    const windowEnd = competition.window_end || competition.quiz_end_time;
    
    setFormData({
      name: competition.name || '',
      description: competition.description || '',
      rules: competition.rules || '',
      show_in_nav: competition.show_in_nav !== false,
      window_start_date: formatDateForInput(windowStart),
      window_start_time: formatTimeForInput(windowStart),
      window_end_date: formatDateForInput(windowEnd),
      window_end_time: formatTimeForInput(windowEnd),
      quiz_duration_minutes: competition.quiz_duration_minutes || competition.duration_minutes || 10,
      questions_per_user: competition.questions_per_user || 10
    });
    setShowEditModal(true);
  };
  
  const handleUpdateCompetition = async () => {
    try {
      // Combine date and time into ISO strings
      const windowStart = new Date(`${formData.window_start_date}T${formData.window_start_time}`);
      const windowEnd = new Date(`${formData.window_end_date}T${formData.window_end_time}`);
      
      if (windowEnd <= windowStart) {
        alert('Competition close time must be after open time');
        return;
      }
      
      const updateData = {
        name: formData.name,
        description: formData.description,
        rules: formData.rules,
        show_in_nav: formData.show_in_nav,
        window_start: windowStart.toISOString(),
        window_end: windowEnd.toISOString(),
        quiz_duration_minutes: formData.quiz_duration_minutes,
        questions_per_user: formData.questions_per_user
      };
      
      await axios.put(
        `${BACKEND_URL}/api/competitions/admin/competitions/${selectedCompetition.id}`,
        updateData,
        { withCredentials: true }
      );
      
      setShowEditModal(false);
      fetchCompetitions();
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to update competition');
    }
  };
  
  const handleCreateCompetition = async () => {
    try {
      // Combine date and time into ISO strings
      const windowStart = new Date(`${formData.window_start_date}T${formData.window_start_time}`);
      const windowEnd = new Date(`${formData.window_end_date}T${formData.window_end_time}`);
      
      if (windowEnd <= windowStart) {
        alert('Competition close time must be after open time');
        return;
      }
      
      const createData = {
        name: formData.name,
        description: formData.description,
        rules: formData.rules,
        show_in_nav: formData.show_in_nav,
        window_start: windowStart.toISOString(),
        window_end: windowEnd.toISOString(),
        quiz_duration_minutes: formData.quiz_duration_minutes,
        questions_per_user: formData.questions_per_user,
        scoring: { correct: 3, wrong: -1, skip: 0 }
      };
      
      await axios.post(
        `${BACKEND_URL}/api/competitions/admin/competitions`,
        createData,
        { withCredentials: true }
      );
      
      setShowCreateModal(false);
      setFormData({
        name: '',
        description: '',
        rules: '',
        show_in_nav: true,
        window_start_date: '',
        window_start_time: '',
        window_end_date: '',
        window_end_time: '',
        quiz_duration_minutes: 10,
        questions_per_user: 10
      });
      fetchCompetitions();
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to create competition');
    }
  };
  
  const handleToggleNavVisibility = async (competition) => {
    try {
      await axios.put(
        `${BACKEND_URL}/api/competitions/admin/competitions/${competition.id}`,
        { show_in_nav: !competition.show_in_nav },
        { withCredentials: true }
      );
      fetchCompetitions();
    } catch (error) {
      alert('Failed to update navigation visibility');
    }
  };
  
  const handleDeleteCompetition = async (id) => {
    if (!window.confirm('Delete this competition and all its questions?')) return;
    
    try {
      await axios.delete(
        `${BACKEND_URL}/api/competitions/admin/competitions/${id}`,
        { withCredentials: true }
      );
      fetchCompetitions();
    } catch (error) {
      alert('Failed to delete competition');
    }
  };
  
  const handleToggleActive = async (competition) => {
    try {
      await axios.put(
        `${BACKEND_URL}/api/competitions/admin/competitions/${competition.id}`,
        { is_active: !competition.is_active },
        { withCredentials: true }
      );
      fetchCompetitions();
    } catch (error) {
      alert('Failed to update competition');
    }
  };
  
  const openQuestionsModal = async (competition) => {
    setSelectedCompetition(competition);
    setShowQuestionsModal(true);
    setQuestionsLoading(true);
    
    try {
      const res = await axios.get(
        `${BACKEND_URL}/api/competitions/admin/competitions/${competition.id}/questions`,
        { withCredentials: true }
      );
      setQuestions(res.data.questions || []);
    } catch (error) {
      console.error('Failed to fetch questions:', error);
    } finally {
      setQuestionsLoading(false);
    }
  };
  
  const handleSeedQuestions = async () => {
    if (!selectedCompetition) return;
    
    try {
      await axios.post(
        `${BACKEND_URL}/api/competitions/admin/competitions/${selectedCompetition.id}/questions/bulk`,
        { questions: SAMPLE_QUESTIONS },
        { withCredentials: true }
      );
      
      // Refresh questions
      const res = await axios.get(
        `${BACKEND_URL}/api/competitions/admin/competitions/${selectedCompetition.id}/questions`,
        { withCredentials: true }
      );
      setQuestions(res.data.questions || []);
      fetchCompetitions();
      
      alert(`Added ${SAMPLE_QUESTIONS.length} questions to the competition!`);
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to seed questions');
    }
  };
  
  const handleDeleteQuestion = async (questionId) => {
    if (!window.confirm('Delete this question?')) return;
    
    try {
      await axios.delete(
        `${BACKEND_URL}/api/competitions/admin/questions/${questionId}`,
        { withCredentials: true }
      );
      setQuestions(questions.filter(q => q.id !== questionId));
      fetchCompetitions();
    } catch (error) {
      alert('Failed to delete question');
    }
  };
  
  const formatDateTime = (dateStr) => {
    if (!dateStr) return 'Not set';
    return new Date(dateStr).toLocaleString();
  };
  
  const getStatusBadge = (competition) => {
    const now = new Date();
    // Use new window fields if available, fallback to legacy fields
    const start = new Date(competition.window_start || competition.quiz_start_time);
    const end = new Date(competition.window_end || competition.quiz_end_time);
    
    if (!competition.is_active) {
      return <Badge className="bg-slate-100 text-slate-600">Inactive</Badge>;
    }
    if (now < start) {
      return <Badge className="bg-amber-100 text-amber-700">Upcoming</Badge>;
    }
    if (now >= start && now <= end) {
      return <Badge className="bg-green-100 text-green-700 animate-pulse">Open</Badge>;
    }
    return <Badge className="bg-slate-100 text-slate-600">Closed</Badge>;
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6" data-testid="competitions-section">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Case Competitions</h2>
          <p className="text-sm text-slate-500">Manage timed quiz competitions</p>
        </div>
        <Button 
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Competition
        </Button>
      </div>
      
      {/* Competitions List */}
      {competitions.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-xl">
          <Trophy className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-medium text-slate-900">No competitions yet</h3>
          <p className="text-sm text-slate-500 mt-1">Create your first case competition</p>
        </div>
      ) : (
        <div className="space-y-4">
          {competitions.map((competition) => {
            const compStats = stats[competition.id] || {};
            const isExpanded = expandedId === competition.id;
            
            return (
              <div
                key={competition.id}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden"
              >
                {/* Main row */}
                <div 
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50"
                  onClick={() => setExpandedId(isExpanded ? null : competition.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                      <Trophy className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-900">{competition.name}</h3>
                        {getStatusBadge(competition)}
                      </div>
                      <p className="text-sm text-slate-500">
                        {competition.question_count || 0} questions • {competition.questions_per_user} per user • {competition.duration_minutes} min
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right text-sm">
                      <p className="text-slate-500">Participants</p>
                      <p className="font-semibold text-slate-900">{compStats.total_participants || 0}</p>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                </div>
                
                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-slate-100">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                      <div className="p-3 bg-slate-50 rounded-lg">
                        <p className="text-xs text-slate-500">Navigation</p>
                        <div className="flex items-center gap-2 mt-1">
                          {competition.show_in_nav !== false ? (
                            <>
                              <Eye className="w-4 h-4 text-green-600" />
                              <span className="text-sm font-medium text-green-600">Visible</span>
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-4 h-4 text-slate-400" />
                              <span className="text-sm font-medium text-slate-500">Hidden</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-lg">
                        <p className="text-xs text-slate-500">Opens</p>
                        <p className="text-sm font-medium text-slate-900">
                          {formatDateTime(competition.window_start || competition.quiz_start_time)}
                        </p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-lg">
                        <p className="text-xs text-slate-500">Closes</p>
                        <p className="text-sm font-medium text-slate-900">
                          {formatDateTime(competition.window_end || competition.quiz_end_time)}
                        </p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-lg">
                        <p className="text-xs text-slate-500">Quiz Time</p>
                        <p className="text-sm font-medium text-slate-900">
                          {competition.quiz_duration_minutes || competition.duration_minutes || 10} mins
                        </p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-lg">
                        <p className="text-xs text-slate-500">Avg Score</p>
                        <p className="text-sm font-medium text-slate-900">
                          {compStats.average_score || 0} pts
                        </p>
                      </div>
                    </div>
                    
                    {/* Stats row */}
                    <div className="flex items-center gap-6 mt-4 p-3 bg-blue-50 rounded-lg text-sm">
                      <div>
                        <span className="text-blue-600">Submitted:</span>
                        <span className="font-semibold ml-1">{compStats.submitted_count || 0}</span>
                      </div>
                      <div>
                        <span className="text-blue-600">In Progress:</span>
                        <span className="font-semibold ml-1">{compStats.in_progress || 0}</span>
                      </div>
                      <div>
                        <span className="text-blue-600">Highest:</span>
                        <span className="font-semibold ml-1">{compStats.highest_score || 0} pts</span>
                      </div>
                      <div>
                        <span className="text-blue-600">Lowest:</span>
                        <span className="font-semibold ml-1">{compStats.lowest_score || 0} pts</span>
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-4 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(competition);
                        }}
                      >
                        <Edit2 className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          openQuestionsModal(competition);
                        }}
                      >
                        <FileText className="w-4 h-4 mr-1" />
                        Questions ({competition.question_count || 0})
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          openParticipantsModal(competition);
                        }}
                      >
                        <Users className="w-4 h-4 mr-1" />
                        Participants ({compStats.total_participants || 0})
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className={competition.show_in_nav !== false 
                          ? "bg-green-50 border-green-200 text-green-700 hover:bg-green-100" 
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleNavVisibility(competition);
                        }}
                      >
                        {competition.show_in_nav !== false ? (
                          <>
                            <Eye className="w-4 h-4 mr-1" />
                            Visible
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-4 h-4 mr-1" />
                            Hidden
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleActive(competition);
                        }}
                      >
                        {competition.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCompetition(competition.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      
      {/* Create Competition Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Create Competition</DialogTitle>
            <DialogDescription>
              Set up a new timed quiz competition
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4 overflow-y-auto flex-1">
            <div>
              <label className="text-sm font-medium text-slate-700">Name</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="FMS Fiesta Conquest"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-slate-700">Description</label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Case competition quiz..."
                rows={2}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-slate-700">Rules & Instructions</label>
              <Textarea
                value={formData.rules}
                onChange={(e) => setFormData({ ...formData, rules: e.target.value })}
                placeholder="• You will have 10 minutes to complete 10 questions&#10;• Scoring: +3 for correct, -1 for wrong, 0 for skipped&#10;• Once you start, the timer cannot be paused&#10;• You cannot go back to previous questions"
                rows={4}
              />
              <p className="text-xs text-slate-500 mt-1">Shown to users before they start the quiz. Use • for bullet points.</p>
            </div>
            
            <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg">
              <Checkbox
                id="show_in_nav"
                checked={formData.show_in_nav}
                onCheckedChange={(checked) => setFormData({ ...formData, show_in_nav: checked })}
              />
              <div>
                <label htmlFor="show_in_nav" className="text-sm font-medium text-slate-700 cursor-pointer">
                  Show in Navigation
                </label>
                <p className="text-xs text-slate-500">When checked, competition appears in user sidebar</p>
              </div>
            </div>
            
            {/* Competition Window */}
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">Competition Window</span>
              </div>
              <p className="text-xs text-blue-600 mb-3">Candidates can start the quiz anytime within this window</p>
              
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Opens - Date</label>
                  <Input
                    type="date"
                    value={formData.window_start_date}
                    onChange={(e) => setFormData({ ...formData, window_start_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Opens - Time</label>
                  <Input
                    type="time"
                    value={formData.window_start_time}
                    onChange={(e) => setFormData({ ...formData, window_start_time: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Closes - Date</label>
                  <Input
                    type="date"
                    value={formData.window_end_date}
                    onChange={(e) => setFormData({ ...formData, window_end_date: e.target.value })}
                    min={formData.window_start_date}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Closes - Time</label>
                  <Input
                    type="time"
                    value={formData.window_end_time}
                    onChange={(e) => setFormData({ ...formData, window_end_time: e.target.value })}
                  />
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Quiz Duration (minutes)</label>
                <Input
                  type="number"
                  value={formData.quiz_duration_minutes}
                  onChange={(e) => setFormData({ ...formData, quiz_duration_minutes: parseInt(e.target.value) })}
                />
                <p className="text-xs text-slate-500 mt-1">Time limit per user once they start</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-slate-700">Questions per User</label>
                <Input
                  type="number"
                  value={formData.questions_per_user}
                  onChange={(e) => setFormData({ ...formData, questions_per_user: parseInt(e.target.value) })}
                />
              </div>
            </div>
            
            <div className="p-3 bg-amber-50 rounded-lg text-sm">
              <div className="flex items-center gap-2 text-amber-700">
                <AlertCircle className="w-4 h-4" />
                <span className="font-medium">Scoring: +3 correct, -1 wrong, 0 skip</span>
              </div>
              <p className="text-amber-600 mt-1">
                Each user has {formData.quiz_duration_minutes || 10} minutes once they start the quiz
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateCompetition}
              disabled={!formData.name || !formData.window_start_date || !formData.window_start_time || !formData.window_end_date || !formData.window_end_time}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Create Competition
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Questions Modal */}
      <Dialog open={showQuestionsModal} onOpenChange={setShowQuestionsModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Questions - {selectedCompetition?.name}
            </DialogTitle>
            <DialogDescription>
              {questions.length} questions in pool • {selectedCompetition?.questions_per_user} shown to each user
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            {/* Seed button */}
            <div className="flex items-center justify-between mb-4 p-4 bg-blue-50 rounded-lg">
              <div>
                <p className="font-medium text-blue-900">Quick Setup</p>
                <p className="text-sm text-blue-700">
                  Add {SAMPLE_QUESTIONS.length} curated case math, guesstimate, and structuring questions
                </p>
              </div>
              <Button
                onClick={handleSeedQuestions}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Seed Questions
              </Button>
            </div>
            
            {questionsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : questions.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-lg">
                <HelpCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No questions yet. Click &quot;Seed Questions&quot; to add sample questions.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {questions.map((q, idx) => (
                  <div
                    key={q.id}
                    className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className="text-xs bg-slate-100 text-slate-600">
                            {idx + 1}
                          </Badge>
                          <Badge className={`text-xs ${
                            q.category === 'case_math' ? 'bg-blue-100 text-blue-700' :
                            q.category === 'guesstimate' ? 'bg-purple-100 text-purple-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {q.category?.replace('_', ' ')}
                          </Badge>
                          <Badge className={`text-xs ${
                            q.difficulty === 'hard' ? 'bg-red-100 text-red-700' :
                            q.difficulty === 'medium' ? 'bg-amber-100 text-amber-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {q.difficulty}
                          </Badge>
                          <Badge className="text-xs bg-slate-100 text-slate-600">
                            {q.question_type?.replace('_', ' ')}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-900">{q.question}</p>
                        {q.options && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {q.options.map((opt, i) => (
                              <span 
                                key={i}
                                className={`text-xs px-2 py-1 rounded ${
                                  opt === q.correct_answer 
                                    ? 'bg-green-100 text-green-700 font-medium' 
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {String.fromCharCode(65 + i)}. {opt}
                              </span>
                            ))}
                          </div>
                        )}
                        {!q.options && (
                          <p className="text-xs text-green-600 mt-1">
                            Answer: {q.correct_answer}
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:bg-red-50"
                        onClick={() => handleDeleteQuestion(q.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQuestionsModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit Competition Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Competition</DialogTitle>
            <DialogDescription>
              Update competition settings and timing
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4 overflow-y-auto flex-1">
            <div>
              <label className="text-sm font-medium text-slate-700">Name</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-slate-700">Description</label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-slate-700">Rules & Instructions</label>
              <Textarea
                value={formData.rules}
                onChange={(e) => setFormData({ ...formData, rules: e.target.value })}
                rows={3}
              />
            </div>
            
            <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg">
              <Checkbox
                id="edit_show_in_nav"
                checked={formData.show_in_nav}
                onCheckedChange={(checked) => setFormData({ ...formData, show_in_nav: checked })}
              />
              <div>
                <label htmlFor="edit_show_in_nav" className="text-sm font-medium text-slate-700 cursor-pointer">
                  Show in Navigation
                </label>
                <p className="text-xs text-slate-500">When checked, competition appears in user sidebar</p>
              </div>
            </div>
            
            {/* Competition Window */}
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">Competition Window</span>
              </div>
              <p className="text-xs text-blue-600 mb-3">Candidates can start the quiz anytime within this window</p>
              
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Opens - Date</label>
                  <Input
                    type="date"
                    value={formData.window_start_date}
                    onChange={(e) => setFormData({ ...formData, window_start_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Opens - Time</label>
                  <Input
                    type="time"
                    value={formData.window_start_time}
                    onChange={(e) => setFormData({ ...formData, window_start_time: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Closes - Date</label>
                  <Input
                    type="date"
                    value={formData.window_end_date}
                    onChange={(e) => setFormData({ ...formData, window_end_date: e.target.value })}
                    min={formData.window_start_date}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Closes - Time</label>
                  <Input
                    type="time"
                    value={formData.window_end_time}
                    onChange={(e) => setFormData({ ...formData, window_end_time: e.target.value })}
                  />
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Quiz Duration (minutes)</label>
                <Input
                  type="number"
                  value={formData.quiz_duration_minutes}
                  onChange={(e) => setFormData({ ...formData, quiz_duration_minutes: parseInt(e.target.value) })}
                />
                <p className="text-xs text-slate-500 mt-1">Time limit per user once they start</p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Questions Per User</label>
                <Input
                  type="number"
                  value={formData.questions_per_user}
                  onChange={(e) => setFormData({ ...formData, questions_per_user: parseInt(e.target.value) })}
                />
              </div>
            </div>
            
            <div className="p-3 bg-amber-50 rounded-lg text-sm">
              <div className="flex items-center gap-2 text-amber-700">
                <AlertCircle className="w-4 h-4" />
                <span className="font-medium">Scoring: +3 correct, -1 wrong, 0 skip</span>
              </div>
              <p className="text-amber-600 mt-1">
                Each user has {formData.quiz_duration_minutes || 10} minutes once they start the quiz
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateCompetition}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Participants Modal */}
      <Dialog open={showParticipantsModal} onOpenChange={setShowParticipantsModal}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Participants - {selectedCompetition?.name}
            </DialogTitle>
            <DialogDescription>
              View all candidates who attempted this competition
            </DialogDescription>
          </DialogHeader>
          
          <div className="overflow-auto max-h-[60vh]">
            {participantsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : participants.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-lg">
                <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No participants yet</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-100 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Candidate</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Started</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Submitted</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-700">Score</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-700">Correct</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-700">Wrong</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-700">Skipped</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-700">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {participants.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-3 py-3">
                        <div>
                          <p className="font-medium text-slate-900">{p.user_name}</p>
                          <p className="text-xs text-slate-500">{p.user_email}</p>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {p.started_at ? new Date(p.started_at).toLocaleString() : '-'}
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {p.submitted_at ? new Date(p.submitted_at).toLocaleString() : '-'}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`font-bold ${p.score >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {p.score}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="text-green-600 font-medium">{p.correct_count}</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="text-red-600 font-medium">{p.wrong_count}</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="text-slate-500">{p.skipped_count}</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        {p.submitted ? (
                          <Badge className="bg-green-100 text-green-700">Completed</Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-700">In Progress</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          
          <DialogFooter className="flex justify-between items-center">
            <Button 
              variant="outline" 
              className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
              onClick={() => exportParticipants(selectedCompetition?.id)}
              disabled={participants.length === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              Export to Excel
            </Button>
            <Button variant="outline" onClick={() => setShowParticipantsModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CompetitionsSection;
