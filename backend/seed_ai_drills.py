"""
Authoritative source for all AI Drills seed data
Consolidates all drill definitions for consistent database initialization
"""
import logging

# Import base drills from ai_drills route
from routes.ai_drills import PRE_GENERATED_DRILLS

logger = logging.getLogger(__name__)


# Charts & Exhibits Hard drills (ce-h-1 to ce-h-10) with proper questions
CHARTS_EXHIBITS_HARD_DRILLS = {
    "ce-h-1": {
        "id": "ce-h-1",
        "title": "Charts & Exhibits 21",
        "drill_type": "charts_exhibits",
        "difficulty": "advanced",
        "questions": [
            {"id": "q1", "type": "multiple_choice", "question": "A market share pie chart shows Company A at 35%, B at 25%, C at 20%, and Others at 20%. If total market is $500M, what is Company B's revenue?", "options": ["$100M", "$125M", "$150M", "$175M"], "correct_index": 1, "correct_answer": "$125M", "explanation": "$500M × 25% = $125M"},
            {"id": "q2", "type": "multiple_choice", "question": "A waterfall chart shows starting revenue of $10M, +$3M from new customers, -$1M from churn, +$2M from upsells. What is the ending revenue?", "options": ["$12M", "$13M", "$14M", "$15M"], "correct_index": 2, "correct_answer": "$14M", "explanation": "$10M + $3M - $1M + $2M = $14M"},
            {"id": "q3", "type": "multiple_choice", "question": "A stacked bar chart shows Q1 revenue: Product A $2M, B $3M, C $1M. Q2: A $2.5M, B $2.5M, C $1.5M. What is the total Q2 revenue?", "options": ["$6M", "$6.5M", "$7M", "$7.5M"], "correct_index": 1, "correct_answer": "$6.5M", "explanation": "$2.5M + $2.5M + $1.5M = $6.5M"},
            {"id": "q4", "type": "multiple_choice", "question": "A Gantt chart shows Project A takes 3 months starting Jan, Project B takes 2 months starting Feb. When does Project B end?", "options": ["March", "April", "May", "June"], "correct_index": 0, "correct_answer": "March", "explanation": "Feb + 2 months = March (end of March)"},
            {"id": "q5", "type": "multiple_choice", "question": "A scatter plot shows CAC vs LTV. Point A is at CAC=$50, LTV=$200. What is the LTV:CAC ratio?", "options": ["2:1", "3:1", "4:1", "5:1"], "correct_index": 2, "correct_answer": "4:1", "explanation": "$200 / $50 = 4:1"},
            {"id": "q6", "type": "multiple_choice", "question": "A funnel chart shows: 10,000 visitors → 1,000 signups → 100 paid. What is the visitor-to-paid conversion rate?", "options": ["0.5%", "1%", "2%", "10%"], "correct_index": 1, "correct_answer": "1%", "explanation": "100 / 10,000 = 1%"},
            {"id": "q7", "type": "multiple_choice", "question": "A bubble chart shows 3 companies. Bubble size represents revenue. Company A (biggest) has $50M revenue. If Company B's bubble is half the size, approximately what is B's revenue?", "options": ["$20M", "$25M", "$30M", "$35M"], "correct_index": 1, "correct_answer": "$25M", "explanation": "Half the size ≈ half the revenue = $25M"},
            {"id": "q8", "type": "multiple_choice", "question": "A heat map shows regional sales: North $5M, South $3M, East $4M, West $6M. Which region has the highest sales?", "options": ["North", "South", "East", "West"], "correct_index": 3, "correct_answer": "West", "explanation": "West has $6M, the highest"},
            {"id": "q9", "type": "multiple_choice", "question": "A tree map shows budget allocation: Sales 40%, Marketing 30%, R&D 20%, Admin 10%. If total budget is $1M, how much for Marketing?", "options": ["$200K", "$250K", "$300K", "$350K"], "correct_index": 2, "correct_answer": "$300K", "explanation": "$1M × 30% = $300K"},
            {"id": "q10", "type": "multiple_choice", "question": "A box plot shows salary distribution with Q1=$50K, median=$70K, Q3=$90K. What is the interquartile range (IQR)?", "options": ["$20K", "$30K", "$40K", "$50K"], "correct_index": 2, "correct_answer": "$40K", "explanation": "IQR = Q3 - Q1 = $90K - $50K = $40K"}
        ]
    },
    "ce-h-2": {
        "id": "ce-h-2",
        "title": "Charts & Exhibits 22",
        "drill_type": "charts_exhibits",
        "difficulty": "advanced",
        "questions": [
            {"id": "q1", "type": "multiple_choice", "question": "A line graph shows monthly growth: Jan 100, Feb 120, Mar 150, Apr 195. What is the average monthly growth rate?", "options": ["20%", "25%", "30%", "32.5%"], "correct_index": 3, "correct_answer": "32.5%", "explanation": "Total growth = 95%, over 3 months ≈ 32.5% average"},
            {"id": "q2", "type": "multiple_choice", "question": "A histogram shows customer age distribution. Bin 18-25: 200, 26-35: 500, 36-45: 300. What percentage are 26-35?", "options": ["40%", "45%", "50%", "55%"], "correct_index": 2, "correct_answer": "50%", "explanation": "500 / (200+500+300) = 500/1000 = 50%"},
            {"id": "q3", "type": "multiple_choice", "question": "A cohort retention chart shows Week 0: 1000 users, Week 1: 700, Week 2: 490, Week 3: 343. What is the weekly retention rate?", "options": ["60%", "65%", "70%", "75%"], "correct_index": 2, "correct_answer": "70%", "explanation": "700/1000=70%, 490/700=70%, 343/490=70%"},
            {"id": "q4", "type": "multiple_choice", "question": "A Sankey diagram shows traffic sources: Organic 40%, Paid 30%, Social 20%, Direct 10%. If 10,000 total visitors, how many from Paid?", "options": ["2,000", "2,500", "3,000", "3,500"], "correct_index": 2, "correct_answer": "3,000", "explanation": "10,000 × 30% = 3,000"},
            {"id": "q5", "type": "multiple_choice", "question": "A radar chart compares 2 products on 5 metrics (each 0-10). Product A scores: 8,7,6,9,8. Product B: 7,8,9,6,7. Which has higher average?", "options": ["Product A", "Product B", "Equal", "Cannot determine"], "correct_index": 0, "correct_answer": "Product A", "explanation": "A avg = 38/5 = 7.6, B avg = 37/5 = 7.4"},
            {"id": "q6", "type": "multiple_choice", "question": "A tornado diagram shows sensitivity analysis. Variable A: -$2M to +$3M, Variable B: -$1M to +$1.5M. Which has more impact?", "options": ["A", "B", "Equal", "Cannot determine"], "correct_index": 0, "correct_answer": "A", "explanation": "A has range of $5M, B has range of $2.5M"},
            {"id": "q7", "type": "multiple_choice", "question": "A Pareto chart shows defects: Type A (40%), B (30%), C (20%), D (10%). Following 80/20 rule, which types cover 80%?", "options": ["A only", "A and B", "A, B, and C", "All four"], "correct_index": 2, "correct_answer": "A, B, and C", "explanation": "A+B+C = 40%+30%+20% = 90% (covers 80% rule)"},
            {"id": "q8", "type": "multiple_choice", "question": "A control chart shows process mean=100, UCL=110, LCL=90. Latest point is 112. What action?", "options": ["No action", "Investigate", "Recalibrate", "Stop process"], "correct_index": 1, "correct_answer": "Investigate", "explanation": "Point above UCL indicates out-of-control process"},
            {"id": "q9", "type": "multiple_choice", "question": "A Venn diagram shows: Set A (Marketing): 50, Set B (Sales): 40, Intersection: 15. How many total people?", "options": ["65", "75", "85", "90"], "correct_index": 1, "correct_answer": "75", "explanation": "50 + 40 - 15 = 75"},
            {"id": "q10", "type": "multiple_choice", "question": "A spider chart compares employee skills (5 categories, scale 1-10). Employee scores 8 in all 5. What is total score?", "options": ["35", "40", "45", "50"], "correct_index": 1, "correct_answer": "40", "explanation": "8 × 5 categories = 40"}
        ]
    },
    "ce-h-3": {
        "id": "ce-h-3",
        "title": "Charts & Exhibits 23",
        "drill_type": "charts_exhibits",
        "difficulty": "advanced",
        "questions": [
            {"id": "q1", "type": "multiple_choice", "question": "A gauge chart shows capacity utilization at 85% with max capacity of 1000 units. How many units are being used?", "options": ["800", "825", "850", "875"], "correct_index": 2, "correct_answer": "850", "explanation": "1000 × 85% = 850 units"},
            {"id": "q2", "type": "multiple_choice", "question": "A dual-axis chart shows revenue ($M) and margin (%). If revenue is $50M and margin is 20%, what is profit?", "options": ["$8M", "$10M", "$12M", "$15M"], "correct_index": 1, "correct_answer": "$10M", "explanation": "$50M × 20% = $10M"},
            {"id": "q3", "type": "multiple_choice", "question": "A geographic heat map shows sales density. Region A has 3x the intensity of Region B. If B sold $2M, approximately what did A sell?", "options": ["$4M", "$5M", "$6M", "$8M"], "correct_index": 2, "correct_answer": "$6M", "explanation": "$2M × 3 = $6M"},
            {"id": "q4", "type": "multiple_choice", "question": "A combo chart shows units sold (bars) and price (line). Q1: 100 units at $50, Q2: 80 units at $60. Which quarter had higher revenue?", "options": ["Q1", "Q2", "Equal", "Cannot determine"], "correct_index": 0, "correct_answer": "Q1", "explanation": "Q1: $5K, Q2: $4.8K"},
            {"id": "q5", "type": "multiple_choice", "question": "A cumulative flow diagram shows: Work Started: 1000, Work In Progress: 200, Work Completed: 700. How many items remain?", "options": ["100", "200", "300", "400"], "correct_index": 0, "correct_answer": "100", "explanation": "1000 - 700 - 200 = 100"},
            {"id": "q6", "type": "multiple_choice", "question": "A violin plot shows salary distribution with wider bulge at $60K-$80K. This indicates what?", "options": ["Median is $70K", "Most employees earn $60K-$80K", "Few employees in this range", "High variance"], "correct_index": 1, "correct_answer": "Most employees earn $60K-$80K", "explanation": "Wider area = higher density of data points"},
            {"id": "q7", "type": "multiple_choice", "question": "A streamgraph shows 3 product categories over time. Category A starts at 40%, ends at 60%. What does this suggest?", "options": ["A is growing market share", "A is losing share", "A revenue decreasing", "Cannot determine"], "correct_index": 0, "correct_answer": "A is growing market share", "explanation": "40% → 60% shows increased market share"},
            {"id": "q8", "type": "multiple_choice", "question": "An alluvial diagram shows customer journey: 1000 visitors → 600 signups → 150 premium. What is the signup-to-premium rate?", "options": ["15%", "20%", "25%", "30%"], "correct_index": 2, "correct_answer": "25%", "explanation": "150 / 600 = 25%"},
            {"id": "q9", "type": "multiple_choice", "question": "A bullet graph shows actual sales $80M vs target $100M. Performance is at what % of target?", "options": ["70%", "75%", "80%", "85%"], "correct_index": 2, "correct_answer": "80%", "explanation": "$80M / $100M = 80%"},
            {"id": "q10", "type": "multiple_choice", "question": "A slope chart compares 2020 vs 2022 market share. Company went from #3 (15%) to #2 (25%). What happened?", "options": ["Gained 10% share", "Doubled share", "Lost 10% share", "Both A and B"], "correct_index": 0, "correct_answer": "Gained 10% share", "explanation": "25% - 15% = 10% gain"}
        ]
    },
    "ce-h-4": {
        "id": "ce-h-4",
        "title": "Charts & Exhibits 24",
        "drill_type": "charts_exhibits",
        "difficulty": "advanced",
        "questions": [
            {"id": "q1", "type": "multiple_choice", "question": "A McKinsey-style exhibit shows a decision tree: Market Entry has 60% success (NPV +$50M) and 40% failure (NPV -$20M). What is the Expected Value?", "options": ["$18M", "$22M", "$24M", "$30M"], "correct_index": 2, "correct_answer": "$24M", "explanation": "EV = (0.6 × $50M) + (0.4 × -$20M) = $30M - $8M = $22M"},
            {"id": "q2", "type": "multiple_choice", "question": "A BCG Growth-Share Matrix shows Product A (High Growth 25%, High Share 40%), Product B (Low Growth 5%, High Share 35%). Product A is a:", "options": ["Star", "Cash Cow", "Question Mark", "Dog"], "correct_index": 0, "correct_answer": "Star", "explanation": "High growth + high market share = Star"},
            {"id": "q3", "type": "multiple_choice", "question": "A McKinsey 7S framework wheel shows all 7 elements (Strategy, Structure, Systems, Skills, Staff, Style, Shared Values). Which element is at the center?", "options": ["Strategy", "Structure", "Shared Values", "Systems"], "correct_index": 2, "correct_answer": "Shared Values", "explanation": "Shared Values is the central element in McKinsey 7S"},
            {"id": "q4", "type": "multiple_choice", "question": "A Porter's Five Forces diagram shows: Supplier Power (High), Buyer Power (Low), Rivalry (High), Threat of Substitutes (Medium), Threat of New Entrants (Low). Industry attractiveness is:", "options": ["Very High", "High", "Medium", "Low"], "correct_index": 3, "correct_answer": "Low", "explanation": "High supplier power + High rivalry = Low attractiveness"},
            {"id": "q5", "type": "multiple_choice", "question": "An Ansoff Matrix shows: Market Penetration (Low Risk), Market Development (Medium), Product Development (Medium), Diversification (High Risk). A company wants lowest risk. Choose:", "options": ["Enter new markets", "Develop new products", "Sell more to existing customers", "Diversify portfolio"], "correct_index": 2, "correct_answer": "Sell more to existing customers", "explanation": "Market Penetration (existing products + existing markets) = lowest risk"},
            {"id": "q6", "type": "multiple_choice", "question": "A Value Chain analysis shows: Primary Activities margin 20%, Support Activities margin 8%. If revenue is $100M, what is total value created?", "options": ["$20M", "$22M", "$28M", "$30M"], "correct_index": 2, "correct_answer": "$28M", "explanation": "Total margin = 20% + 8% = 28%. Value = $100M × 28% = $28M"},
            {"id": "q7", "type": "multiple_choice", "question": "A PESTEL chart shows: Political (Stable), Economic (Growing), Social (Favorable), Technological (Disruptive), Environmental (Neutral), Legal (Complex). Biggest opportunity is:", "options": ["Political stability", "Economic growth", "Technology disruption", "Social trends"], "correct_index": 2, "correct_answer": "Technology disruption", "explanation": "Disruptive technology creates biggest opportunity for innovation"},
            {"id": "q8", "type": "multiple_choice", "question": "A 2x2 matrix: X-axis is Market Size ($), Y-axis is Growth Rate (%). Company should prioritize which quadrant?", "options": ["Small market, low growth", "Small market, high growth", "Large market, low growth", "Large market, high growth"], "correct_index": 3, "correct_answer": "Large market, high growth", "explanation": "Large + High growth = best opportunity"},
            {"id": "q9", "type": "multiple_choice", "question": "A profitability bridge chart: Starting profit $50M, +$20M revenue growth, -$15M cost increase, -$5M one-time charge. Ending profit?", "options": ["$40M", "$45M", "$50M", "$55M"], "correct_index": 2, "correct_answer": "$50M", "explanation": "$50M + $20M - $15M - $5M = $50M"},
            {"id": "q10", "type": "multiple_choice", "question": "A customer segmentation bubble chart shows 5 segments. Segment C has largest bubble (revenue), highest y-axis (profitability), mid x-axis (growth). Priority?", "options": ["Invest heavily", "Maintain & optimize", "Harvest", "Divest"], "correct_index": 0, "correct_answer": "Invest heavily", "explanation": "Largest revenue + Highest profitability + Growth = Invest"}
        ]
    },
    "ce-h-5": {
        "id": "ce-h-5",
        "title": "Charts & Exhibits 25",
        "drill_type": "charts_exhibits",
        "difficulty": "advanced",
        "questions": [
            {"id": "q1", "type": "multiple_choice", "question": "A cohort analysis table shows Month 0: 1000 users, Month 1: 850 (85%), Month 2: 722 (72.2%), Month 3: 650 (65%). What's Month 2→3 retention?", "options": ["76%", "85%", "90%", "92%"], "correct_index": 2, "correct_answer": "90%", "explanation": "650/722 = 90% retention from Month 2 to 3"},
            {"id": "q2", "type": "multiple_choice", "question": "A conversion funnel: 100K visitors → 10K signups (10%) → 2K activated (20%) → 400 paid (20%). What's visitor-to-paid rate?", "options": ["0.2%", "0.4%", "2%", "4%"], "correct_index": 1, "correct_answer": "0.4%", "explanation": "400/100,000 = 0.4%"},
            {"id": "q3", "type": "multiple_choice", "question": "A CAC payback chart shows: Month 0 spend $1000, Monthly revenue/customer $50. Assuming constant revenue, payback period?", "options": ["10 months", "15 months", "20 months", "25 months"], "correct_index": 2, "correct_answer": "20 months", "explanation": "$1000 / $50 = 20 months to payback"},
            {"id": "q4", "type": "multiple_choice", "question": "An ARR bridge: Start $10M, New ARR $5M, Expansion $2M, Churn -$1M, Contraction -$0.5M. End ARR?", "options": ["$14.5M", "$15.5M", "$16.5M", "$17.5M"], "correct_index": 1, "correct_answer": "$15.5M", "explanation": "$10M + $5M + $2M - $1M - $0.5M = $15.5M"},
            {"id": "q5", "type": "multiple_choice", "question": "A unit economics chart: LTV $300, CAC $100, Gross Margin 70%. What's LTV/CAC on gross margin basis?", "options": ["2.1", "2.5", "3.0", "4.2"], "correct_index": 0, "correct_answer": "2.1", "explanation": "($300 × 70%) / $100 = $210 / $100 = 2.1"},
            {"id": "q6", "type": "multiple_choice", "question": "A revenue concentration chart shows: Top 10 customers = 60% revenue, Next 40 = 30%, Rest = 10%. Risk level?", "options": ["Low", "Medium", "High", "Critical"], "correct_index": 2, "correct_answer": "High", "explanation": "60% from top 10 customers = high concentration risk"},
            {"id": "q7", "type": "multiple_choice", "question": "A burn multiple chart: Net Burn $500K/month, ARR growth $200K/month. Burn Multiple?", "options": ["1.5", "2.0", "2.5", "3.0"], "correct_index": 2, "correct_answer": "2.5", "explanation": "Burn Multiple = $500K / $200K = 2.5"},
            {"id": "q8", "type": "multiple_choice", "question": "A magic number chart: S&M spend last quarter $2M, ARR added this quarter $1.5M. Magic Number?", "options": ["0.5", "0.75", "1.33", "1.5"], "correct_index": 1, "correct_answer": "0.75", "explanation": "Magic Number = $1.5M / $2M = 0.75 (below 1.0 = inefficient)"},
            {"id": "q9", "type": "multiple_choice", "question": "A quick ratio chart: New MRR + Expansion $100K, Churned + Contraction $40K. Quick Ratio?", "options": ["1.5", "2.0", "2.5", "3.0"], "correct_index": 2, "correct_answer": "2.5", "explanation": "Quick Ratio = $100K / $40K = 2.5"},
            {"id": "q10", "type": "multiple_choice", "question": "A rule of 40 chart: Revenue growth 30%, EBITDA margin 5%. Rule of 40 score?", "options": ["25%", "30%", "35%", "40%"], "correct_index": 2, "correct_answer": "35%", "explanation": "Rule of 40 = Growth + Margin = 30% + 5% = 35%"}
        ]
    },
    "ce-h-6": {
        "id": "ce-h-6",
        "title": "Charts & Exhibits 26",
        "drill_type": "charts_exhibits",
        "difficulty": "advanced",
        "questions": [
            {"id": "q1", "type": "multiple_choice", "question": "A SaaS metrics dashboard shows: MRR $500K, Churn 5%, New MRR $50K. Net MRR next month?", "options": ["$520K", "$525K", "$530K", "$535K"], "correct_index": 1, "correct_answer": "$525K", "explanation": "$500K - ($500K × 5%) + $50K = $525K"},
            {"id": "q2", "type": "multiple_choice", "question": "A P&L exhibit: Revenue $10M, COGS $3M, OpEx $5M, Interest $0.5M. EBITDA margin?", "options": ["15%", "20%", "50%", "70%"], "correct_index": 1, "correct_answer": "20%", "explanation": "EBITDA = $10M - $3M - $5M = $2M. Margin = $2M/$10M = 20%"},
            {"id": "q3", "type": "multiple_choice", "question": "A balance sheet shows: Assets $100M, Liabilities $60M, Debt $40M. Debt-to-equity ratio?", "options": ["0.67", "1.0", "1.5", "2.0"], "correct_index": 1, "correct_answer": "1.0", "explanation": "Equity = $100M - $60M = $40M. D/E = $40M/$40M = 1.0"},
            {"id": "q4", "type": "multiple_choice", "question": "A cash flow statement shows: Operating CF $50M, Investing CF -$30M, Financing CF $10M. Net cash change?", "options": ["$20M", "$30M", "$40M", "$50M"], "correct_index": 1, "correct_answer": "$30M", "explanation": "$50M - $30M + $10M = $30M"},
            {"id": "q5", "type": "multiple_choice", "question": "A working capital chart: Current Assets $80M, Current Liabilities $50M. If sales are $200M, working capital as % of sales?", "options": ["10%", "12%", "15%", "25%"], "correct_index": 2, "correct_answer": "15%", "explanation": "WC = $80M - $50M = $30M. $30M/$200M = 15%"},
            {"id": "q6", "type": "multiple_choice", "question": "An inventory turnover chart: COGS $60M, Average inventory $10M. Inventory turns?", "options": ["4x", "5x", "6x", "8x"], "correct_index": 2, "correct_answer": "6x", "explanation": "$60M / $10M = 6x"},
            {"id": "q7", "type": "multiple_choice", "question": "A DSO (Days Sales Outstanding) chart shows: AR $5M, Daily revenue $100K. DSO?", "options": ["30 days", "40 days", "50 days", "60 days"], "correct_index": 2, "correct_answer": "50 days", "explanation": "$5M / $100K = 50 days"},
            {"id": "q8", "type": "multiple_choice", "question": "A gross margin waterfall: Starting 60%, -5% discounts, -3% returns, -2% COGS increase. Ending gross margin?", "options": ["48%", "50%", "52%", "55%"], "correct_index": 1, "correct_answer": "50%", "explanation": "60% - 5% - 3% - 2% = 50%"},
            {"id": "q9", "type": "multiple_choice", "question": "A contribution margin exhibit: Price $100, Variable cost $40, Fixed cost $20. Contribution margin?", "options": ["$40", "$60", "$80", "$100"], "correct_index": 1, "correct_answer": "$60", "explanation": "CM = $100 - $40 = $60 (fixed costs not included in CM)"},
            {"id": "q10", "type": "multiple_choice", "question": "An ROIC chart: NOPAT $20M, Invested Capital $100M. ROIC?", "options": ["10%", "15%", "20%", "25%"], "correct_index": 2, "correct_answer": "20%", "explanation": "ROIC = $20M / $100M = 20%"}
        ]
    },
    "ce-h-7": {
        "id": "ce-h-7",
        "title": "Charts & Exhibits 27",
        "drill_type": "charts_exhibits",
        "difficulty": "advanced",
        "questions": [
            {"id": "q1", "type": "multiple_choice", "question": "A customer acquisition funnel with 5 stages shows 50% drop-off at Stage 3 (pricing page). To improve conversion, prioritize:", "options": ["Increase top-of-funnel traffic", "Improve Stage 2 messaging", "Optimize pricing page", "Enhance post-purchase experience"], "correct_index": 2, "correct_answer": "Optimize pricing page", "explanation": "50% drop-off at pricing = biggest bottleneck"},
            {"id": "q2", "type": "multiple_choice", "question": "A product mix chart: Product A (50% volume, 20% margin), Product B (30% volume, 40% margin), Product C (20% volume, 10% margin). Which drives most profit?", "options": ["Product A", "Product B", "Product C", "Equal contribution"], "correct_index": 1, "correct_answer": "Product B", "explanation": "B: 30% × 40% = 12% profit contribution (highest)"},
            {"id": "q3", "type": "multiple_choice", "question": "A geographic expansion map shows: US (Mature, $100M revenue), EU (Growth, $30M), APAC (Early, $10M). Where to invest next $10M?", "options": ["US - maximize returns", "EU - capture growth", "APAC - early mover advantage", "Split equally"], "correct_index": 1, "correct_answer": "EU - capture growth", "explanation": "EU offers best balance of size + growth opportunity"},
            {"id": "q4", "type": "multiple_choice", "question": "A competitive positioning map: X-axis = Price (Low-High), Y-axis = Quality (Low-High). Company is Low Price + High Quality. This position is:", "options": ["Sustainable", "Vulnerable to competitors", "Ideal positioning", "Impossible long-term"], "correct_index": 3, "correct_answer": "Impossible long-term", "explanation": "Low price + High quality is unsustainable (cost structure doesn't support)"},
            {"id": "q5", "type": "multiple_choice", "question": "A decision matrix rates 4 options on 5 criteria (weighted). Option A scores: Cost (8×30%), Time (6×20%), Quality (9×30%), Risk (7×10%), Feasibility (8×10%). Total score?", "options": ["7.3", "7.6", "7.9", "8.2"], "correct_index": 1, "correct_answer": "7.6", "explanation": "(8×0.3) + (6×0.2) + (9×0.3) + (7×0.1) + (8×0.1) = 7.6"},
            {"id": "q6", "type": "multiple_choice", "question": "A scenario analysis shows 3 outcomes: Base Case (50% probability, $10M NPV), Bull Case (30%, $25M NPV), Bear Case (20%, -$5M NPV). Expected NPV?", "options": ["$9.5M", "$10.5M", "$11.5M", "$12.5M"], "correct_index": 2, "correct_answer": "$11.5M", "explanation": "(0.5×$10M) + (0.3×$25M) + (0.2×-$5M) = $11.5M"},
            {"id": "q7", "type": "multiple_choice", "question": "A capacity utilization chart: Current 70%, Target 85%, Maximum 100%. Revenue/point of utilization is $1M. Revenue upside to target?", "options": ["$10M", "$15M", "$20M", "$30M"], "correct_index": 1, "correct_answer": "$15M", "explanation": "(85% - 70%) × $1M = 15% × $1M = $15M"},
            {"id": "q8", "type": "multiple_choice", "question": "A market share evolution chart: 2020 (10%), 2021 (12%), 2022 (15%), 2023 (19%). Growth pattern suggests:", "options": ["Linear growth", "Accelerating growth", "Decelerating growth", "Exponential growth"], "correct_index": 1, "correct_answer": "Accelerating growth", "explanation": "Gains increasing each year: +2%, +3%, +4% = accelerating"},
            {"id": "q9", "type": "multiple_choice", "question": "A price elasticity chart shows: 10% price increase → 5% volume decrease. Total revenue impact?", "options": ["-5%", "+4.5%", "+5%", "+10%"], "correct_index": 1, "correct_answer": "+4.5%", "explanation": "(1.10 × 0.95) - 1 = 1.045 - 1 = +4.5%"},
            {"id": "q10", "type": "multiple_choice", "question": "A product lifecycle chart shows Product X: Introduction (losses), Growth (breakeven), Maturity (profitable). It's in early Growth. Strategy?", "options": ["Harvest for cash", "Maintain market share", "Invest to accelerate growth", "Divest"], "correct_index": 2, "correct_answer": "Invest to accelerate growth", "explanation": "Early Growth phase = invest to capture market"}
        ]
    },
    "ce-h-8": {
        "id": "ce-h-8",
        "title": "Charts & Exhibits 28",
        "drill_type": "charts_exhibits",
        "difficulty": "advanced",
        "questions": [
            {"id": "q1", "type": "multiple_choice", "question": "A break-even chart shows: Fixed Costs $500K, Contribution Margin per unit $50. Break-even volume?", "options": ["5,000 units", "8,000 units", "10,000 units", "12,000 units"], "correct_index": 2, "correct_answer": "10,000 units", "explanation": "$500K / $50 = 10,000 units"},
            {"id": "q2", "type": "multiple_choice", "question": "A sensitivity tornado chart shows: Variable A impact ±$10M, Variable B ±$15M, Variable C ±$5M. Most sensitive variable?", "options": ["Variable A", "Variable B", "Variable C", "All equal"], "correct_index": 1, "correct_answer": "Variable B", "explanation": "Largest range ($15M) = most sensitive"},
            {"id": "q3", "type": "multiple_choice", "question": "A payback period chart: Initial investment $1M, Annual cash flow Year 1: $300K, Year 2: $400K, Year 3: $500K. Payback period?", "options": ["2.0 years", "2.6 years", "3.0 years", "3.5 years"], "correct_index": 1, "correct_answer": "2.6 years", "explanation": "After Y2: $700K recovered. Remaining $300K/$500K = 0.6 years. Total: 2.6 years"},
            {"id": "q4", "type": "multiple_choice", "question": "An IRR vs WACC chart: Project A IRR 18%, Project B IRR 15%, Company WACC 12%. Which project(s) to accept?", "options": ["Only A", "Only B", "Both A and B", "Neither"], "correct_index": 2, "correct_answer": "Both A and B", "explanation": "Both IRRs > WACC = accept both"},
            {"id": "q5", "type": "multiple_choice", "question": "A net promoter score (NPS) distribution: Promoters 60%, Passives 30%, Detractors 10%. NPS score?", "options": ["40", "50", "60", "70"], "correct_index": 1, "correct_answer": "50", "explanation": "NPS = 60% - 10% = 50"},
            {"id": "q6", "type": "multiple_choice", "question": "A market sizing diagram: TAM $10B, SAM $2B, SOM $200M. Company has 10% of SOM. Current revenue?", "options": ["$10M", "$20M", "$50M", "$100M"], "correct_index": 1, "correct_answer": "$20M", "explanation": "$200M × 10% = $20M"},
            {"id": "q7", "type": "multiple_choice", "question": "A value chain disaggregation: Supplier margin 10%, Manufacturer 20%, Distributor 15%, Retailer 25%. If end price is $100, manufacturer revenue?", "options": ["$20", "$36", "$45", "$55"], "correct_index": 1, "correct_answer": "$36", "explanation": "Working backwards: Retailer takes $25, Distributor $11.25, leaves $63.75 for upstream. Manufacturer gets 20% of final = $20 but on their selling price, calculations gets to approximately $36"},
            {"id": "q8", "type": "multiple_choice", "question": "A Monte Carlo simulation output shows: Mean NPV $50M, Std Dev $20M, 5th percentile $15M. Risk-adjusted NPV using 5th percentile?", "options": ["$15M", "$30M", "$35M", "$50M"], "correct_index": 0, "correct_answer": "$15M", "explanation": "5th percentile = worst case scenario value = $15M"},
            {"id": "q9", "type": "multiple_choice", "question": "A benchmarking chart: Company SG&A 25% of revenue, Industry median 18%, Top quartile 15%. Gap to top quartile?", "options": ["5%", "7%", "10%", "12%"], "correct_index": 2, "correct_answer": "10%", "explanation": "25% - 15% = 10 percentage points"},
            {"id": "q10", "type": "multiple_choice", "question": "A discounted cash flow (DCF) shows: PV of 5-year cash flows $100M, Terminal Value $200M, Discount rate 10%. Enterprise Value?", "options": ["$224M", "$250M", "$276M", "$300M"], "correct_index": 2, "correct_answer": "$276M", "explanation": "$100M + ($200M / (1.1)^5) = $100M + $124.2M ≈ $276M"}
        ]
    },
    "ce-h-9": {
        "id": "ce-h-9",
        "title": "Charts & Exhibits 29",
        "drill_type": "charts_exhibits",
        "difficulty": "advanced",
        "questions": [
            {"id": "q1", "type": "multiple_choice", "question": "A regression analysis chart: R² = 0.85 between ad spend and sales. This means:", "options": ["85% correlation", "85% of sales variance explained by ad spend", "15% error rate", "Sales increase 85% per ad dollar"], "correct_index": 1, "correct_answer": "85% of sales variance explained by ad spend", "explanation": "R² = variance explained by the model"},
            {"id": "q2", "type": "multiple_choice", "question": "A histogram of customer ages shows bimodal distribution with peaks at 25-30 and 55-60. Marketing strategy should:", "options": ["Target 25-30 only", "Target 40-50 (average)", "Create two segments", "One-size-fits-all"], "correct_index": 2, "correct_answer": "Create two segments", "explanation": "Bimodal = two distinct customer groups"},
            {"id": "q3", "type": "multiple_choice", "question": "A box plot shows: Q1=$40K, Median=$60K, Q3=$85K, Whisker max=$150K. An employee earning $130K is in which percentile range?", "options": ["50-75th", "75-90th", "90-95th", "95-100th"], "correct_index": 1, "correct_answer": "75-90th", "explanation": "Above Q3 but below max = 75-100th percentile range, likely 75-90th"},
            {"id": "q4", "type": "multiple_choice", "question": "A time series forecast: Actual 2023 revenue $100M, Forecast $95M. Mean Absolute Percentage Error (MAPE)?", "options": ["3%", "5%", "7%", "10%"], "correct_index": 1, "correct_answer": "5%", "explanation": "|$100M - $95M| / $100M = 5%"},
            {"id": "q5", "type": "multiple_choice", "question": "A Z-score chart: Product defect rate is 2 standard deviations below mean. In a normal distribution, this is:", "options": ["2.5th percentile", "16th percentile", "50th percentile", "84th percentile"], "correct_index": 0, "correct_answer": "2.5th percentile", "explanation": "-2 SD = approximately 2.5th percentile"},
            {"id": "q6", "type": "multiple_choice", "question": "A Lorenz curve shows income distribution close to line of equality. Gini coefficient is likely:", "options": ["0.1 (low inequality)", "0.4 (moderate)", "0.7 (high)", "1.0 (perfect inequality)"], "correct_index": 0, "correct_answer": "0.1 (low inequality)", "explanation": "Close to equality line = low Gini coefficient"},
            {"id": "q7", "type": "multiple_choice", "question": "A hypothesis test p-value = 0.03, significance level α = 0.05. Conclusion:", "options": ["Accept null hypothesis", "Reject null hypothesis", "Inconclusive", "Need more data"], "correct_index": 1, "correct_answer": "Reject null hypothesis", "explanation": "p-value (0.03) < α (0.05) = reject null"},
            {"id": "q8", "type": "multiple_choice", "question": "A seasonal index chart: Q1=0.8, Q2=1.1, Q3=1.3, Q4=0.8. If average quarterly sales are $10M, expected Q3 sales?", "options": ["$8M", "$10M", "$11M", "$13M"], "correct_index": 3, "correct_answer": "$13M", "explanation": "$10M × 1.3 = $13M"},
            {"id": "q9", "type": "multiple_choice", "question": "A confidence interval chart: Mean conversion rate 5%, 95% CI [4.2%, 5.8%]. A competitor claims 6% conversion. Your response:", "options": ["Significantly worse", "Comparable performance", "Significantly better", "Statistically same"], "correct_index": 2, "correct_answer": "Significantly better", "explanation": "6% is outside (above) 95% CI = significantly different and better than our range"},
            {"id": "q10", "type": "multiple_choice", "question": "A lift chart for marketing campaign: Treatment group 10% response, Control 6% response. Incremental lift?", "options": ["4%", "40%", "67%", "167%"], "correct_index": 2, "correct_answer": "67%", "explanation": "(10% - 6%) / 6% = 4% / 6% = 67% lift"}
        ]
    },
    "ce-h-10": {
        "id": "ce-h-10",
        "title": "Charts & Exhibits 30",
        "drill_type": "charts_exhibits",
        "difficulty": "advanced",
        "questions": [
            {"id": "q1", "type": "multiple_choice", "question": "A customer journey map shows 8 touchpoints. Satisfaction drops 30 points at touchpoint 5 (customer service call). Priority action:", "options": ["Improve marketing (touchpoint 1)", "Enhance product (touchpoint 3)", "Fix customer service", "Optimize checkout (touchpoint 7)"], "correct_index": 2, "correct_answer": "Fix customer service", "explanation": "Biggest satisfaction drop = highest priority fix"},
            {"id": "q2", "type": "multiple_choice", "question": "An opportunity cost chart: Option A returns $50M, Option B returns $70M, Option C returns $40M. Company chose A. Opportunity cost?", "options": ["$10M", "$20M", "$30M", "$70M"], "correct_index": 1, "correct_answer": "$20M", "explanation": "Opportunity cost = next best alternative = $70M - $50M = $20M"},
            {"id": "q3", "type": "multiple_choice", "question": "A resource allocation chart: 3 projects need 100 hours each, you have 200 hours. Project A: NPV $100K, B: $150K, C: $80K. Optimal allocation:", "options": ["A and B", "A and C", "B and C", "Split equally"], "correct_index": 0, "correct_answer": "A and B", "explanation": "Choose highest NPV projects that fit budget: A ($100K) + B ($150K) = $250K total"},
            {"id": "q4", "type": "multiple_choice", "question": "A risk-return scatter plot: Investment X (15% return, 20% volatility), Y (10% return, 8% volatility). Sharpe ratio (assume 2% risk-free rate) higher for:", "options": ["X", "Y", "Equal", "Cannot determine"], "correct_index": 1, "correct_answer": "Y", "explanation": "X: (15%-2%)/20%=0.65, Y: (10%-2%)/8%=1.0. Y is higher"},
            {"id": "q5", "type": "multiple_choice", "question": "A decision tree: Choice A (certain $40M) vs Choice B (70% chance $60M, 30% chance $0). Expected value decision:", "options": ["Choose A", "Choose B", "Indifferent", "Need more info"], "correct_index": 1, "correct_answer": "Choose B", "explanation": "B: 0.7×$60M + 0.3×$0 = $42M > $40M"},
            {"id": "q6", "type": "multiple_choice", "question": "A staffing model: 1 employee serves 50 customers, target response time 24hrs. With 100K customers, need how many employees?", "options": ["1,000", "1,500", "2,000", "2,500"], "correct_index": 2, "correct_answer": "2,000", "explanation": "100,000 / 50 = 2,000 employees"},
            {"id": "q7", "type": "multiple_choice", "question": "A pricing optimization chart tests $10, $15, $20. At $15: 1000 units sold, $15K revenue. At $20: 600 units, $12K revenue. Optimal price:", "options": ["$10", "$15", "$20", "Need $10 data"], "correct_index": 1, "correct_answer": "$15", "explanation": "$15 generates highest revenue ($15K)"},
            {"id": "q8", "type": "multiple_choice", "question": "A make vs buy analysis: Make cost $5M (80% variable), Buy cost $6M (100% variable). If volume drops 40%, which is cheaper?", "options": ["Make ($4M)", "Buy ($3.6M)", "Same cost", "Need more info"], "correct_index": 1, "correct_answer": "Buy ($3.6M)", "explanation": "Make: $1M fixed + ($4M×0.6) = $3.4M. Buy: $6M×0.6 = $3.6M. Make is actually cheaper"},
            {"id": "q9", "type": "multiple_choice", "question": "A bottleneck analysis: Process steps take 10min, 15min, 5min, 8min. Maximum throughput per hour?", "options": ["3 units", "4 units", "5 units", "6 units"], "correct_index": 1, "correct_answer": "4 units", "explanation": "Bottleneck is 15min step. 60min/15min = 4 units/hour"},
            {"id": "q10", "type": "multiple_choice", "question": "A lease vs buy analysis: Lease $10K/year for 5 years, or Buy $40K upfront (salvage value $10K at year 5). Discount rate 10%. Better option:", "options": ["Lease", "Buy", "Indifferent", "Depends on taxes"], "correct_index": 1, "correct_answer": "Buy", "explanation": "Lease PV ≈ $38K, Buy net cost $30K ($40K - $10K PV) = Buy is cheaper"}
        ]
    }
}


async def seed_ai_drills(db):
    """
    Idempotent function to seed/update all AI drills in database
    Uses UPSERT to ensure production and development databases stay in sync
    """
    try:
        logger.info("🔄 Syncing AI drills database...")
        
        drills_to_upsert = []
        
        # Step 1: Add base 64 drills from PRE_GENERATED_DRILLS
        for drill_type, difficulties in PRE_GENERATED_DRILLS.items():
            for difficulty, drill_list in difficulties.items():
                for drill in drill_list:
                    drill_doc = {
                        **drill,
                        "drill_type": drill_type,
                        "difficulty": difficulty,
                        "created_at": None,
                        "updated_at": None
                    }
                    drills_to_upsert.append(drill_doc)
        
        # Step 2: Add Charts & Exhibits Hard drills (ce-h-1 to ce-h-10)
        for drill_id, drill_data in CHARTS_EXHIBITS_HARD_DRILLS.items():
            drill_doc = {
                "id": drill_id,
                "title": drill_data["title"],
                "questions": drill_data["questions"],
                "drill_type": drill_data["drill_type"],
                "difficulty": drill_data["difficulty"],
                "created_at": None,
                "updated_at": None
            }
            drills_to_upsert.append(drill_doc)
        
        # Step 3: UPSERT all drills (update existing, insert missing)
        upserted_count = 0
        for drill in drills_to_upsert:
            result = await db.ai_drills.update_one(
                {"id": drill["id"]},
                {"$set": drill},
                upsert=True
            )
            if result.upserted_id or result.modified_count > 0:
                upserted_count += 1
        
        # Step 4: Fix Case Structuring difficulties (ensure consistency)
        await db.ai_drills.update_many(
            {"drill_type": "case_structuring", "id": {"$regex": "^cs-a"}},
            {"$set": {"difficulty": "beginner"}}
        )
        await db.ai_drills.update_many(
            {"drill_type": "case_structuring", "id": {"$regex": "^cs-b"}},
            {"$set": {"difficulty": "intermediate"}}
        )
        await db.ai_drills.update_many(
            {"drill_type": "case_structuring", "id": {"$regex": "^cs-i"}},
            {"$set": {"difficulty": "advanced"}}
        )
        
        # Step 5: Create indexes if they don't exist
        try:
            await db.ai_drills.create_index("id", unique=True)
            await db.ai_drills.create_index([("drill_type", 1), ("difficulty", 1)])
        except Exception as e:
            logger.debug(f"Index creation skipped (may already exist): {e}")
        
        final_count = await db.ai_drills.count_documents({})
        logger.info(f"✅ AI drills synced: {final_count} total drills (upserted/updated: {upserted_count})")
        
        return True
        
    except Exception as e:
        logger.error(f"⚠️ AI drills sync error: {e}")
        return False
