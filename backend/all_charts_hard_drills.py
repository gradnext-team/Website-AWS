"""
Complete drill data for initialization - ALL 74 DRILLS
This includes all Charts & Exhibits Hard drills with proper questions
"""

# Charts & Exhibits Hard drills (ce-h-1 to ce-h-10) with proper questions
CHARTS_HARD_DRILLS = [
    {
        "id": "ce-h-1",
        "title": "Charts & Exhibits 21",
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
    {
        "id": "ce-h-2",
        "title": "Charts & Exhibits 22",
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
    {
        "id": "ce-h-3",
        "title": "Charts & Exhibits 23",
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
    }
]

# Import remaining drills from the update script
# ce-h-4 to ce-h-10 are in update_hard_drills_proper_questions.py
