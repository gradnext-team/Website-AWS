from datetime import datetime, timedelta
import random

# Mentor data - Real mentors from gradnext team
# Updated July 2025 with actual mentor information from database
# Includes all photos, logos, and contact details
mentors_data = [
    {
        "id": "mentor-aparajita",
        "name": "Aparajita Subramanian",
        "title": "Senior Associate",
        "company": "BCG",
        "email": "jita1902@gmail.com",
        "bio": "BCG Senior Associate with 6 years of consulting experience. Previously worked at PWC and TCS before joining BCG.",
        "expertise": ['Strategy', 'Case Interviews', 'Consulting'],
        "linkedin": "https://www.linkedin.com/in/aparajita-subramanian-05295317a/",
        "picture": "/api/images/img_5cdc21a95a31",
        "years_experience": 6,
        "sessions_conducted": 0,
        "rating": 5.0,
        "is_active": True,
        "location": "India",
        "current_company": "BCG",
        "is_current_consultant": True,
        "consulting_firm": "BCG",
        "consulting_firm_logo": "/api/images/img_8e9decb5ad9d",
        "consulting_position": "Senior Associate",
        "consulting_is_current": True,
        "current_company_logo": "/api/images/img_8e9decb5ad9d",
        "hourly_rate": 1000,
        "price_per_session": 2999,
        "is_top_coach": False,
        "can_take_strategy_calls": False,
        "phone": "7667050963",
        "headline": "",
        "specialization": "BCG",
        "previous_company_1": "",
        "previous_company_2": "",
    },
    {
        "id": "mentor-kritika",
        "name": "Kritika Jalan",
        "title": "Senior Associate Consultant",
        "company": "Bain & Company",
        "email": "kritikajalan.98@gmail.com",
        "bio": "Bain Senior Associate Consultant with 4 years of experience. Previously worked at Swiss Re before joining Bain.",
        "expertise": ['Strategy', 'Case Interviews', 'Consulting'],
        "linkedin": "https://www.linkedin.com/in/kritika-jalan/",
        "picture": "/api/images/img_617e5accb264",
        "years_experience": 4,
        "sessions_conducted": 0,
        "rating": 5.0,
        "is_active": True,
        "location": "India",
        "current_company": "Bain & Company",
        "is_current_consultant": True,
        "consulting_firm": "Bain",
        "consulting_firm_logo": "/api/images/img_eb3b5470e7f7",
        "consulting_position": "Senior Associate Consultant",
        "consulting_is_current": False,
        "current_company_logo": "/api/images/img_eb3b5470e7f7",
        "hourly_rate": 1000,
        "price_per_session": 2999,
        "is_top_coach": False,
        "can_take_strategy_calls": False,
        "phone": "9088767760",
        "headline": "",
        "specialization": "Bain",
        "previous_company_1": "",
        "previous_company_2": "",
    },
    {
        "id": "mentor-nikhil",
        "name": "Nikhil Nair",
        "title": "Consultant",
        "company": "Bain & Company",
        "email": "nikhilnair.contact@gmail.com",
        "bio": "Bain Consultant with 5 years of experience. Previously worked at Pharmarack. CA qualified professional.",
        "expertise": ['Strategy', 'Case Interviews', 'Finance'],
        "linkedin": "https://www.linkedin.com/in/ca-nikhil-nair/",
        "picture": "/api/images/img_45880f118248",
        "years_experience": 5,
        "sessions_conducted": 0,
        "rating": 5.0,
        "is_active": True,
        "location": "India",
        "current_company": "Bain & Company",
        "is_current_consultant": True,
        "consulting_firm": "Bain",
        "consulting_firm_logo": "/api/images/img_eb3b5470e7f7",
        "consulting_position": "Consultant",
        "consulting_is_current": False,
        "current_company_logo": "/api/images/img_eb3b5470e7f7",
        "hourly_rate": 1000,
        "price_per_session": 2999,
        "is_top_coach": False,
        "can_take_strategy_calls": False,
        "phone": "9076970432",
        "headline": "",
        "specialization": "Bain",
        "previous_company_1": "",
        "previous_company_2": "",
    },
    {
        "id": "mentor-siddharth-p",
        "name": "Siddharth Panpaliya",
        "title": "Consultant",
        "company": "Lenovo",
        "email": "siddharth.panpaliya15@gmail.com",
        "bio": "Former BCG Consultant with 3 years of consulting experience. Previously worked at Flipkart. Currently at Lenovo.",
        "expertise": ['Strategy', 'Case Interviews', 'Tech'],
        "linkedin": "https://www.linkedin.com/in/siddharth-panpaliya-465266152/",
        "picture": "/api/images/img_42b0115d58b9",
        "years_experience": 3,
        "sessions_conducted": 0,
        "rating": 5.0,
        "is_active": True,
        "location": "India",
        "current_company": "Lenovo",
        "is_current_consultant": False,
        "consulting_firm": "BCG",
        "consulting_firm_logo": "/api/images/img_8e9decb5ad9d",
        "consulting_position": "Consultant",
        "consulting_is_current": False,
        "current_company_logo": None,
        "hourly_rate": 1000,
        "price_per_session": 2999,
        "is_top_coach": False,
        "can_take_strategy_calls": False,
        "phone": "9148977836",
        "headline": "",
        "specialization": "BCG",
        "previous_company_1": "",
        "previous_company_2": "",
    },
    {
        "id": "mentor-thaman",
        "name": "Thaman Veer",
        "title": "Senior Associate Consultant",
        "company": "Noon",
        "email": "thamanveer3679@gmail.com",
        "bio": "Former Bain Senior Associate Consultant with 8 years of experience. Previously worked at Impact Consulting. Currently at Noon.",
        "expertise": ['Strategy', 'Case Interviews', 'Operations'],
        "linkedin": "https://www.linkedin.com/in/thaman-veer/",
        "picture": "/api/images/img_0b72038fff29",
        "years_experience": 8,
        "sessions_conducted": 0,
        "rating": 5.0,
        "is_active": True,
        "location": "India",
        "current_company": "Noon",
        "is_current_consultant": False,
        "consulting_firm": "Bain",
        "consulting_firm_logo": "/api/images/img_eb3b5470e7f7",
        "consulting_position": "Senior Associate Consultant",
        "consulting_is_current": False,
        "current_company_logo": None,
        "hourly_rate": 1000,
        "price_per_session": 2999,
        "is_top_coach": False,
        "can_take_strategy_calls": False,
        "phone": "8143798539",
        "headline": "",
        "specialization": "Bain",
        "previous_company_1": "",
        "previous_company_2": "",
    },
    {
        "id": "mentor-vikram-g",
        "name": "Vikram Gunda",
        "title": "Director",
        "company": "Oliver Wyman",
        "email": "gunda.vikram@gmail.com",
        "bio": "Oliver Wyman Director with 13 years of experience. Previously worked at BCG and Accenture.",
        "expertise": ['Strategy', 'Leadership', 'Case Interviews'],
        "linkedin": "https://www.linkedin.com/in/vikramgunda/",
        "picture": "/api/images/img_0a4490ff94ae",
        "years_experience": 13,
        "sessions_conducted": 0,
        "rating": 5.0,
        "is_active": True,
        "location": "India",
        "current_company": "Oliver Wyman",
        "is_current_consultant": True,
        "consulting_firm": "Oliver Wyman",
        "consulting_firm_logo": None,
        "consulting_position": "Director",
        "consulting_is_current": False,
        "current_company_logo": None,
        "hourly_rate": 1250,
        "price_per_session": 2999,
        "is_top_coach": False,
        "can_take_strategy_calls": False,
        "phone": "8130145511",
        "headline": "",
        "specialization": "Oliver Wyman",
        "previous_company_1": "BCG",
        "previous_company_2": "",
    },
    {
        "id": "mentor-aman",
        "name": "Aman Tomar",
        "title": "Consultant",
        "company": "Spinny",
        "email": "aman.t2494@gmail.com",
        "bio": "Former BCG Consultant with 8 years of experience. Previously worked at OYO. Currently at Spinny.",
        "expertise": ['Strategy', 'Case Interviews', 'Growth'],
        "linkedin": "https://www.linkedin.com/in/amantomar/",
        "picture": "/api/images/img_cb7a0ce3f2b5",
        "years_experience": 8,
        "sessions_conducted": 0,
        "rating": 5.0,
        "is_active": True,
        "location": "India",
        "current_company": "Spinny",
        "is_current_consultant": False,
        "consulting_firm": "BCG",
        "consulting_firm_logo": "/api/images/img_8e9decb5ad9d",
        "consulting_position": "Consultant",
        "consulting_is_current": False,
        "current_company_logo": None,
        "hourly_rate": 2000,
        "price_per_session": 2999,
        "is_top_coach": False,
        "can_take_strategy_calls": False,
        "phone": "+14342429570",
        "headline": "",
        "specialization": "BCG",
        "previous_company_1": "",
        "previous_company_2": "",
    },
    {
        "id": "mentor-astha",
        "name": "Astha Maloo",
        "title": "Consultant",
        "company": "Bain & Company",
        "email": "astha.maloo@gmail.com",
        "bio": "Bain Consultant with 4 years of consulting experience. Expert in case interviews and strategy consulting.",
        "expertise": ['Strategy', 'Case Interviews', 'Consulting'],
        "linkedin": "https://www.linkedin.com/in/astha-maloo-17674121a/",
        "picture": "/api/images/img_2ff851ad8266",
        "years_experience": 4,
        "sessions_conducted": 0,
        "rating": 5.0,
        "is_active": True,
        "location": "India",
        "current_company": "Bain & Company",
        "is_current_consultant": True,
        "consulting_firm": "Bain",
        "consulting_firm_logo": "/api/images/img_eb3b5470e7f7",
        "consulting_position": "Consultant",
        "consulting_is_current": False,
        "current_company_logo": "/api/images/img_eb3b5470e7f7",
        "hourly_rate": 1000,
        "price_per_session": 2999,
        "is_top_coach": False,
        "can_take_strategy_calls": False,
        "phone": "9175863009",
        "headline": "",
        "specialization": "Bain",
        "previous_company_1": "",
        "previous_company_2": "",
    },
    {
        "id": "mentor-arpit",
        "name": "Arpit Agrawal",
        "title": "Consultant",
        "company": "Amazon",
        "email": "Arpitagrawal1050@gmail.com",
        "bio": "Former BCG Consultant with 10 years of experience. Previously worked at Deloitte Consulting. Currently at Amazon.",
        "expertise": ['Strategy', 'Case Interviews', 'Tech'],
        "linkedin": "https://www.linkedin.com/in/arpitagrawal1050/",
        "picture": "/api/images/img_1a110ca4f6f4",
        "years_experience": 10,
        "sessions_conducted": 0,
        "rating": 5.0,
        "is_active": True,
        "location": "USA",
        "current_company": "Amazon",
        "is_current_consultant": False,
        "consulting_firm": "BCG",
        "consulting_firm_logo": "/api/images/img_8e9decb5ad9d",
        "consulting_position": "Consultant",
        "consulting_is_current": False,
        "current_company_logo": None,
        "hourly_rate": 1400,
        "price_per_session": 2999,
        "is_top_coach": False,
        "can_take_strategy_calls": False,
        "phone": "8130308722",
        "headline": "",
        "specialization": "BCG",
        "previous_company_1": "",
        "previous_company_2": "",
    },
    {
        "id": "mentor-abhishek",
        "name": "Abhishek Hiteshi",
        "title": "Project Leader",
        "company": "BCG",
        "email": "abhishekhiteshi@gmail.com",
        "bio": "BCG Project Leader with 9 years of experience. Previously worked at Kearney and Accenture Strategy and Consulting.",
        "expertise": ['Strategy', 'Leadership', 'Case Interviews'],
        "linkedin": "https://www.linkedin.com/in/link2abhiarora/",
        "picture": "/api/images/img_a05079d1ceaf",
        "years_experience": 9,
        "sessions_conducted": 0,
        "rating": 5.0,
        "is_active": True,
        "location": "India",
        "current_company": "BCG",
        "is_current_consultant": True,
        "consulting_firm": "BCG",
        "consulting_firm_logo": "/api/images/img_8e9decb5ad9d",
        "consulting_position": "Project Leader",
        "consulting_is_current": False,
        "current_company_logo": "/api/images/img_8e9decb5ad9d",
        "hourly_rate": 1500,
        "price_per_session": 2999,
        "is_top_coach": False,
        "can_take_strategy_calls": False,
        "phone": "9812856438",
        "headline": "",
        "specialization": "BCG",
        "previous_company_1": "Kearney",
        "previous_company_2": "",
    },
    {
        "id": "mentor-tanvi",
        "name": "Tanvi Jain",
        "title": "Senior Associate",
        "company": "BCG",
        "email": "tanvij25@iimklive.com",
        "bio": "Former BCG Senior Associate with 5 years of experience. Previously worked at Deutsche Bank. Currently at Blinkit.",
        "expertise": ['Strategy', 'Case Interviews', 'Finance'],
        "linkedin": "https://www.linkedin.com/in/tanvijain98/",
        "picture": "/api/images/img_4291a1f8cd10",
        "years_experience": 5,
        "sessions_conducted": 0,
        "rating": 5.0,
        "is_active": True,
        "location": "India",
        "current_company": "BCG",
        "is_current_consultant": False,
        "consulting_firm": "BCG",
        "consulting_firm_logo": "/api/images/img_8e9decb5ad9d",
        "consulting_position": "Senior Associate",
        "consulting_is_current": False,
        "current_company_logo": "/api/images/img_8e9decb5ad9d",
        "hourly_rate": 1000,
        "price_per_session": 2999,
        "is_top_coach": False,
        "can_take_strategy_calls": False,
        "phone": "7389922535",
        "headline": "",
        "specialization": "BCG",
        "previous_company_1": "",
        "previous_company_2": "",
    },
    {
        "id": "mentor-praneeth",
        "name": "Praneeth Allada",
        "title": "Consultant",
        "company": "Dell",
        "email": "praneethallada@gmail.com",
        "bio": "Former BCG Consultant with 4 years of experience. Previously worked at Merilytics. Currently at Dell.",
        "expertise": ['Strategy', 'Case Interviews', 'Analytics'],
        "linkedin": "https://www.linkedin.com/in/allada-praneeth/",
        "picture": "/api/images/img_57b79a4f25fd",
        "years_experience": 4,
        "sessions_conducted": 0,
        "rating": 5.0,
        "is_active": True,
        "location": "India",
        "current_company": "Dell",
        "is_current_consultant": False,
        "consulting_firm": "BCG",
        "consulting_firm_logo": "/api/images/img_8e9decb5ad9d",
        "consulting_position": "Consultant",
        "consulting_is_current": False,
        "current_company_logo": None,
        "hourly_rate": 1000,
        "price_per_session": 2999,
        "is_top_coach": False,
        "can_take_strategy_calls": False,
        "phone": "7021837014",
        "headline": "",
        "specialization": "BCG",
        "previous_company_1": "",
        "previous_company_2": "",
    },
    {
        "id": "mentor-dev",
        "name": "Dev Daga",
        "title": "Associate",
        "company": "McKinsey & Company",
        "email": "devdaga6@gmail.com",
        "bio": "McKinsey Associate with 4 years of consulting experience. Expert in strategy and case interviews.",
        "expertise": ['Strategy', 'Case Interviews', 'Consulting'],
        "linkedin": "https://www.linkedin.com/in/devdaga/",
        "picture": "/api/images/img_f98798625171",
        "years_experience": 4,
        "sessions_conducted": 0,
        "rating": 5.0,
        "is_active": True,
        "location": "India",
        "current_company": "McKinsey & Company",
        "is_current_consultant": True,
        "consulting_firm": "McKinsey",
        "consulting_firm_logo": "/api/images/img_33080662aa95",
        "consulting_position": "Associate",
        "consulting_is_current": False,
        "current_company_logo": "/api/images/img_33080662aa95",
        "hourly_rate": 1000,
        "price_per_session": 2999,
        "is_top_coach": False,
        "can_take_strategy_calls": False,
        "phone": "9836592807",
        "headline": "",
        "specialization": "McKinsey",
        "previous_company_1": "",
        "previous_company_2": "",
    },
    {
        "id": "mentor-anamitra",
        "name": "Anamitra Munsi",
        "title": "Consultant",
        "company": "FSG",
        "email": "anamitramunsi2@gmail.com",
        "bio": "FSG Senior Consultant with 9 years of experience. Previously worked at BCG and ONGC.",
        "expertise": ['Strategy', 'Social Impact', 'Case Interviews'],
        "linkedin": "https://www.linkedin.com/in/anamitra-munsi/",
        "picture": "/api/images/img_1706971618ba",
        "years_experience": 9,
        "sessions_conducted": 0,
        "rating": 5.0,
        "is_active": True,
        "location": "India",
        "current_company": "FSG",
        "is_current_consultant": True,
        "consulting_firm": "BCG",
        "consulting_firm_logo": "/api/images/img_8e9decb5ad9d",
        "consulting_position": "Consultant",
        "consulting_is_current": False,
        "current_company_logo": None,
        "hourly_rate": 1000,
        "price_per_session": 2999,
        "is_top_coach": False,
        "can_take_strategy_calls": False,
        "phone": "8051109808",
        "headline": "",
        "specialization": "BCG",
        "previous_company_1": "",
        "previous_company_2": "",
    },
    {
        "id": "mentor-rahhel",
        "name": "Rahhel Kadri",
        "title": "Senior Engagement Manager",
        "company": "McKinsey & Company",
        "email": "rahhel42@gmail.com",
        "bio": "McKinsey Senior Engagement Manager with 5 years of experience. Previously worked at Fractal Analytics.",
        "expertise": ['Strategy', 'Leadership', 'Case Interviews'],
        "linkedin": "https://www.linkedin.com/in/rahhel/",
        "picture": "/api/images/img_68ff0cb0f070",
        "years_experience": 5,
        "sessions_conducted": 0,
        "rating": 5.0,
        "is_active": True,
        "location": "India",
        "current_company": "McKinsey & Company",
        "is_current_consultant": True,
        "consulting_firm": "McKinsey",
        "consulting_firm_logo": "/api/images/img_33080662aa95",
        "consulting_position": "Senior Engagement Manager",
        "consulting_is_current": False,
        "current_company_logo": "/api/images/img_33080662aa95",
        "hourly_rate": 1500,
        "price_per_session": 2999,
        "is_top_coach": False,
        "can_take_strategy_calls": False,
        "phone": "9004550419",
        "headline": "",
        "specialization": "McKinsey",
        "previous_company_1": "",
        "previous_company_2": "",
    },
    {
        "id": "mentor-siddharth-s",
        "name": "Siddharth",
        "title": "Associate",
        "company": "Kearney",
        "email": "siddharth.s2201@gmail.com",
        "bio": "Kearney Associate with 4 years of consulting experience. Expert in strategy and case interviews.",
        "expertise": ['Strategy', 'Case Interviews', 'Consulting'],
        "linkedin": "https://www.linkedin.com/in/siddharth-a680121aa/",
        "picture": "",
        "years_experience": 4,
        "sessions_conducted": 0,
        "rating": 5.0,
        "is_active": True,
        "location": "India",
        "current_company": "Kearney",
        "is_current_consultant": True,
        "consulting_firm": "Kearney",
        "consulting_firm_logo": None,
        "consulting_position": "Associate",
        "consulting_is_current": False,
        "current_company_logo": None,
        "hourly_rate": 1200,
        "price_per_session": 2999,
        "is_top_coach": False,
        "can_take_strategy_calls": False,
        "phone": "9818402628",
        "headline": "",
        "specialization": "Kearney",
        "previous_company_1": "",
        "previous_company_2": "",
    },
    {
        "id": "mentor-anurag",
        "name": "Anurag Gupta",
        "title": "Project Leader",
        "company": "Cisco",
        "email": "anuragg.94@gmail.com",
        "bio": "Former BCG Project Leader with 7 years of experience. Currently at Cisco in Singapore.",
        "expertise": ['Strategy', 'Leadership', 'Case Interviews'],
        "linkedin": "https://www.linkedin.com/in/anurag-gupta-55037487/",
        "picture": "/api/images/img_faa9da6c8118",
        "years_experience": 7,
        "sessions_conducted": 0,
        "rating": 5.0,
        "is_active": True,
        "location": "Singapore",
        "current_company": "Cisco",
        "is_current_consultant": False,
        "consulting_firm": "BCG",
        "consulting_firm_logo": "/api/images/img_8e9decb5ad9d",
        "consulting_position": "Project Leader",
        "consulting_is_current": False,
        "current_company_logo": None,
        "hourly_rate": 1500,
        "price_per_session": 2999,
        "is_top_coach": False,
        "can_take_strategy_calls": False,
        "phone": "9990882699",
        "headline": "",
        "specialization": "BCG",
        "previous_company_1": "",
        "previous_company_2": "",
    },
    {
        "id": "mentor-vedant",
        "name": "Vedant Matta",
        "title": "Consultant",
        "company": "BCG",
        "email": "vedantmatta00@gmail.com",
        "bio": "BCG Consultant with 3 years of consulting experience. Expert in strategy and case interviews.",
        "expertise": ['Strategy', 'Case Interviews', 'Consulting'],
        "linkedin": "https://www.linkedin.com/in/vedantmatta/",
        "picture": "/api/images/img_11a7305db036",
        "years_experience": 3,
        "sessions_conducted": 0,
        "rating": 5.0,
        "is_active": True,
        "location": "India",
        "current_company": "BCG",
        "is_current_consultant": True,
        "consulting_firm": "BCG",
        "consulting_firm_logo": "/api/images/img_8e9decb5ad9d",
        "consulting_position": "Consultant",
        "consulting_is_current": True,
        "current_company_logo": "/api/images/img_8e9decb5ad9d",
        "hourly_rate": 1000,
        "price_per_session": 2999,
        "is_top_coach": False,
        "can_take_strategy_calls": False,
        "phone": "9479554628",
        "headline": "",
        "specialization": "BCG",
        "previous_company_1": "",
        "previous_company_2": "",
    },
    {
        "id": "mentor-rishav",
        "name": "Rishav Ranjan",
        "title": "Project Leader",
        "company": "Acai Theory",
        "email": "rishavranjan007@gmail.com",
        "bio": "Former BCG Project Leader with 11 years of experience. Previously worked at Auctus Advisor. Currently at Acai Theory.",
        "expertise": ['Strategy', 'Leadership', 'Case Interviews'],
        "linkedin": "https://www.linkedin.com/in/rishav-ranjan-38971144/",
        "picture": "/api/images/img_9326dbb9d9ae",
        "years_experience": 11,
        "sessions_conducted": 0,
        "rating": 5.0,
        "is_active": True,
        "location": "India",
        "current_company": "Acai Theory",
        "is_current_consultant": False,
        "consulting_firm": "BCG",
        "consulting_firm_logo": "/api/images/img_8e9decb5ad9d",
        "consulting_position": "Project Leader",
        "consulting_is_current": False,
        "current_company_logo": None,
        "hourly_rate": 1500,
        "price_per_session": 2999,
        "is_top_coach": False,
        "can_take_strategy_calls": False,
        "phone": "7042392463",
        "headline": "",
        "specialization": "BCG",
        "previous_company_1": "",
        "previous_company_2": "",
    },
    {
        "id": "mentor-rakhi",
        "name": "Rakhi Jain",
        "title": "Consultant",
        "company": "BCG",
        "email": "jainrakhie7@gmail.com",
        "bio": "BCG Consultant with 11 years of experience. Previously worked at Tvasta and Fast + Epp. Based in Canada.",
        "expertise": ['Strategy', 'Case Interviews', 'Consulting'],
        "linkedin": "https://www.linkedin.com/in/rakhij/",
        "picture": "/api/images/img_6e697c4d6eaf",
        "years_experience": "8",
        "sessions_conducted": 0,
        "rating": 5.0,
        "is_active": True,
        "location": "Canada",
        "current_company": "BCG",
        "is_current_consultant": True,
        "consulting_firm": "BCG",
        "consulting_firm_logo": "/api/images/img_8e9decb5ad9d",
        "consulting_position": "Consultant",
        "consulting_is_current": False,
        "current_company_logo": "/api/images/img_8e9decb5ad9d",
        "hourly_rate": 1000,
        "price_per_session": 2999,
        "is_top_coach": False,
        "can_take_strategy_calls": False,
        "phone": "+1432373830",
        "headline": "",
        "specialization": "BCG",
        "previous_company_1": "",
        "previous_company_2": "",
    },
    {
        "id": "mentor-isha",
        "name": "Isha Kazi",
        "title": "Strategy Consultant",
        "company": "Arthur D. Little",
        "email": "ishakazi26@gmail.com",
        "bio": "Strategy Consultant with 5 years of experience at Arthur D. Little. Previously worked at Nike and Netflix. Currently at BCG.",
        "expertise": ['Strategy', 'Case Interviews', 'Consumer'],
        "linkedin": "https://www.linkedin.com/in/ishakazi/",
        "picture": "/api/images/img_6298e2370ce9",
        "years_experience": 5,
        "sessions_conducted": 0,
        "rating": 5.0,
        "is_active": True,
        "location": "UAE",
        "current_company": "Arthur D. Little",
        "is_current_consultant": True,
        "consulting_firm": "Other",
        "consulting_firm_logo": None,
        "consulting_position": "Strategy Consultant",
        "consulting_is_current": False,
        "current_company_logo": "/api/images/img_e6d07a12e7fa",
        "hourly_rate": 1250,
        "price_per_session": 2999,
        "is_top_coach": False,
        "can_take_strategy_calls": False,
        "phone": "9920693431",
        "headline": "",
        "specialization": "Other",
        "previous_company_1": "",
        "previous_company_2": "",
    },
    {
        "id": "mentor-ankit",
        "name": "Ankit Luthra",
        "title": "Engagement Manager",
        "company": "Monitor Deloitte",
        "email": "ankit.1208@gmail.com",
        "bio": "Monitor Deloitte Engagement Manager with 7 years of experience. Previously worked at The Kraft Heinz Company and Birla.",
        "expertise": ['Strategy', 'Leadership', 'Case Interviews'],
        "linkedin": "https://www.linkedin.com/in/ankitluthra1/",
        "picture": "/api/images/img_6114d5c9344b",
        "years_experience": "10",
        "sessions_conducted": 0,
        "rating": 5.0,
        "is_active": True,
        "location": "India",
        "current_company": "Monitor Deloitte",
        "is_current_consultant": True,
        "consulting_firm": "Other",
        "consulting_firm_logo": None,
        "consulting_position": "Engagement Manager",
        "consulting_is_current": False,
        "current_company_logo": None,
        "hourly_rate": 1000,
        "price_per_session": 2999,
        "is_top_coach": False,
        "can_take_strategy_calls": False,
        "phone": "8929273573",
        "headline": "",
        "specialization": "Other",
        "previous_company_1": "",
        "previous_company_2": "",
    },
    {
        "id": "mentor-ritika",
        "name": "Ritika Goel",
        "title": "Management Consultant",
        "company": "Anny",
        "email": "goelritika07@gmail.com",
        "bio": "McKinsey Management Consultant with 4 years of experience. Currently at ANNY N Lodha Group.",
        "expertise": ['Strategy', 'Case Interviews', 'Consulting'],
        "linkedin": "https://www.linkedin.com/in/ritika-goel-5baaba163/",
        "picture": "/api/images/img_73b5b111d0c4",
        "years_experience": 4,
        "sessions_conducted": 0,
        "rating": 5.0,
        "is_active": True,
        "location": "India",
        "current_company": "Anny",
        "is_current_consultant": True,
        "consulting_firm": "McKinsey",
        "consulting_firm_logo": "/api/images/img_33080662aa95",
        "consulting_position": "Management Consultant",
        "consulting_is_current": False,
        "current_company_logo": None,
        "hourly_rate": 1500,
        "price_per_session": 2999,
        "is_top_coach": False,
        "can_take_strategy_calls": False,
        "phone": "89685 74997",
        "headline": "",
        "specialization": "McKinsey",
        "previous_company_1": "",
        "previous_company_2": "",
    },
    {
        "id": "mentor-akash",
        "name": "Akash Kyal",
        "title": "Project Leader",
        "company": "BCG",
        "email": "akashkyal@gmail.com",
        "bio": "BCG Project Leader with 9 years of experience. Currently at BCG Auctus Advisor.",
        "expertise": ['Strategy', 'Leadership', 'Case Interviews'],
        "linkedin": "https://www.linkedin.com/in/akashkyal/",
        "picture": "/api/images/img_5a980bdbd623",
        "years_experience": 9,
        "sessions_conducted": 0,
        "rating": 5.0,
        "is_active": True,
        "location": "India",
        "current_company": "BCG",
        "is_current_consultant": True,
        "consulting_firm": "BCG",
        "consulting_firm_logo": "/api/images/img_8e9decb5ad9d",
        "consulting_position": "Project Leader",
        "consulting_is_current": False,
        "current_company_logo": "/api/images/img_8e9decb5ad9d",
        "hourly_rate": 1500,
        "price_per_session": 2999,
        "is_top_coach": False,
        "can_take_strategy_calls": False,
        "phone": "95999 25395",
        "headline": "",
        "specialization": "BCG",
        "previous_company_1": "",
        "previous_company_2": "",
    },
    {
        "id": "mentor-jay",
        "name": "Jay Patel",
        "title": "Associate",
        "company": "McKinsey & Company",
        "email": "Jay.patel@picuscap.com",
        "bio": "Former McKinsey Associate with 4 years of experience. Currently at Picus Capital.",
        "expertise": ['Strategy', 'Case Interviews', 'Venture Capital'],
        "linkedin": "https://www.linkedin.com/in/jay-patel-990664128/",
        "picture": "/api/images/img_0be17fed4463",
        "years_experience": 4,
        "sessions_conducted": 0,
        "rating": 5.0,
        "is_active": True,
        "location": "India",
        "current_company": "McKinsey & Company",
        "is_current_consultant": False,
        "consulting_firm": "McKinsey",
        "consulting_firm_logo": "/api/images/img_33080662aa95",
        "consulting_position": "Associate",
        "consulting_is_current": False,
        "current_company_logo": "/api/images/img_33080662aa95",
        "hourly_rate": 1500,
        "price_per_session": 2999,
        "is_top_coach": False,
        "can_take_strategy_calls": False,
        "phone": "7428 769 545",
        "headline": "",
        "specialization": "McKinsey",
        "previous_company_1": "",
        "previous_company_2": "",
    },
    {
        "id": "mentor-aditya",
        "name": "Aditya Fialok",
        "title": "Project Leader",
        "company": "BCG",
        "email": "adityafialok@gmail.com",
        "bio": "BCG Project Leader with 17 years of experience. Currently at Accenture. One of the most experienced mentors.",
        "expertise": ['Strategy', 'Leadership', 'Case Interviews'],
        "linkedin": "https://www.linkedin.com/in/adityafialok/",
        "picture": "/api/images/img_d0ffdd255e9f",
        "years_experience": 17,
        "sessions_conducted": 0,
        "rating": 5.0,
        "is_active": True,
        "location": "India",
        "current_company": "BCG",
        "is_current_consultant": True,
        "consulting_firm": "BCG",
        "consulting_firm_logo": "/api/images/img_8e9decb5ad9d",
        "consulting_position": "Project Leader",
        "consulting_is_current": False,
        "current_company_logo": "/api/images/img_8e9decb5ad9d",
        "hourly_rate": 1500,
        "price_per_session": 2999,
        "is_top_coach": False,
        "can_take_strategy_calls": False,
        "phone": "99876 54434",
        "headline": "",
        "specialization": "BCG",
        "previous_company_1": "",
        "previous_company_2": "",
    },
]

# Video lessons data
videos_data = [
    {
        "id": "video-1",
        "title": "Introduction to Case Interviews",
        "description": "Learn the fundamentals of case interviews and what top consulting firms look for in candidates.",
        "duration": "25 min",
        "module": "Getting Started",
        "order": 1,
        "thumbnail": "https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&h=225&fit=crop",
        "video_url": "https://example.com/video1",
        "is_free": True
    },
    {
        "id": "video-2",
        "title": "Structuring Your Approach",
        "description": "Master the art of structuring case problems with MECE frameworks.",
        "duration": "35 min",
        "module": "Getting Started",
        "order": 2,
        "thumbnail": "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=400&h=225&fit=crop",
        "video_url": "https://example.com/video2",
        "is_free": True
    },
    {
        "id": "video-3",
        "title": "Profitability Framework Deep Dive",
        "description": "Comprehensive guide to solving profitability cases with real examples.",
        "duration": "45 min",
        "module": "Profitability",
        "order": 3,
        "thumbnail": "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=225&fit=crop",
        "video_url": "https://example.com/video3",
        "is_free": False
    },
    {
        "id": "video-4",
        "title": "Revenue Analysis Techniques",
        "description": "Breaking down revenue using 4As, 4Cs, and 4Ps frameworks.",
        "duration": "40 min",
        "module": "Profitability",
        "order": 4,
        "thumbnail": "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=225&fit=crop",
        "video_url": "https://example.com/video4",
        "is_free": False
    },
    {
        "id": "video-5",
        "title": "Cost Reduction Strategies",
        "description": "Learn to identify and analyze cost reduction opportunities.",
        "duration": "35 min",
        "module": "Profitability",
        "order": 5,
        "thumbnail": "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&h=225&fit=crop",
        "video_url": "https://example.com/video5",
        "is_free": False
    },
    {
        "id": "video-6",
        "title": "Market Entry Framework",
        "description": "Step-by-step approach to market entry and expansion cases.",
        "duration": "50 min",
        "module": "Market Entry",
        "order": 6,
        "thumbnail": "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&h=225&fit=crop",
        "video_url": "https://example.com/video6",
        "is_free": False
    },
    {
        "id": "video-7",
        "title": "Growth Strategy Cases",
        "description": "Using Ansoff Matrix and growth frameworks effectively.",
        "duration": "45 min",
        "module": "Growth",
        "order": 7,
        "thumbnail": "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=400&h=225&fit=crop",
        "video_url": "https://example.com/video7",
        "is_free": False
    },
    {
        "id": "video-8",
        "title": "M&A Framework Mastery",
        "description": "Complete guide to merger and acquisition case interviews.",
        "duration": "55 min",
        "module": "M&A",
        "order": 8,
        "thumbnail": "https://images.unsplash.com/photo-1553729459-efe14ef6055d?w=400&h=225&fit=crop",
        "video_url": "https://example.com/video8",
        "is_free": False
    },
    {
        "id": "video-9",
        "title": "Guesstimates & Market Sizing",
        "description": "Top-down and bottom-up approaches to estimation questions.",
        "duration": "40 min",
        "module": "Guesstimates",
        "order": 9,
        "thumbnail": "https://images.unsplash.com/photo-1526628953301-3e589a6a8b74?w=400&h=225&fit=crop",
        "video_url": "https://example.com/video9",
        "is_free": False
    },
    {
        "id": "video-10",
        "title": "Fit Interview Excellence",
        "description": "Ace the personal experience and behavioral questions.",
        "duration": "35 min",
        "module": "Fit Interview",
        "order": 10,
        "thumbnail": "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=400&h=225&fit=crop",
        "video_url": "https://example.com/video10",
        "is_free": False
    }
]

# Workshops data
workshops_data = [
    {
        "id": "workshop-1",
        "title": "Profitability Case Masterclass",
        "description": "Live session solving 3 profitability cases with detailed feedback.",
        "mentor_name": "Priya Sharma",
        "date": "2025-01-10",
        "time": "10:00 AM IST",
        "duration": "2 hours",
        "is_past": True,
        "recording_url": "https://example.com/workshop1",
        "is_free": True
    },
    {
        "id": "workshop-2",
        "title": "Market Entry Strategies",
        "description": "Deep dive into market entry cases with McKinsey examples.",
        "mentor_name": "Rahul Mehta",
        "date": "2025-01-17",
        "time": "6:00 PM IST",
        "duration": "2 hours",
        "is_past": True,
        "recording_url": "https://example.com/workshop2",
        "is_free": False
    },
    {
        "id": "workshop-3",
        "title": "Mental Math Bootcamp",
        "description": "Speed calculation techniques for case interviews.",
        "mentor_name": "Sneha Reddy",
        "date": "2025-01-24",
        "time": "7:00 PM IST",
        "duration": "1.5 hours",
        "is_past": False,
        "recording_url": None,
        "is_free": False
    },
    {
        "id": "workshop-4",
        "title": "Fit Interview Excellence",
        "description": "Master behavioral questions with STAR methodology.",
        "mentor_name": "Vikram Singh",
        "date": "2025-02-01",
        "time": "11:00 AM IST",
        "duration": "2 hours",
        "is_past": False,
        "recording_url": None,
        "is_free": False
    }
]

# Default testimonials data - Created on first deployment, never overwritten
# Updated February 2026 with all 28 testimonials from database
# All testimonials show on home, coaching, and subscription pages
testimonials_data = [
    {
        "id": "testimonial-6",
        "name": "Dinesh M",
        "position": "Consultant",
        "company_joined": "McKinsey & Company",
        "company_joined_logo": "https://customer-assets.emergentagent.com/job_deploy-restore-bug/artifacts/4q3shjsf_image.png",
        "college": "Texas A&M",
        "college_logo": "/api/images/img_4d84f8d524e6",
        "current_company": "McKinsey & Company",
        "current_company_logo": "",
        "image_url": "https://customer-assets.emergentagent.com/job_deploy-restore-bug/artifacts/mql9c766_image.png",
        "testimonial": "I had a great experience working with the grad next to prepare for my case interviews. The support and guidance I received were instrumental in improving both my confidence and my performance during the actual interviews. A special thanks to Kashish and Nikhil, who were exceptional throughout the process. Kashish brought clarity and structure to complex problems and always made sure I understood not just the \"how\" but also the \"why\" behind every step. Nikhil's insights and constructive feedback helped me refine my approach and think more critically under pressure.\n\nTheir mock sessions were well-structured, realistic, and tailored to my needs. I truly appreciated the attention to detail, the patience, and the personalized feedback that helped me progress with each session.\n\nI would highly recommend their services to anyone serious about case interview preparation.",
        "plan_subscribed": "Full Prep",
        "rating": 5,
        "linkedin_url": "",
        "is_active": True,
        "show_on_pages": ['home', 'coaching', 'subscription'],
        "order": 1,
        "created_at": "2024-06-15T11:30:00Z"
    },
    {
        "id": "testimonial-7",
        "name": "Shubh Chadha",
        "position": "Consultant",
        "company_joined": "BCG",
        "company_joined_logo": "https://customer-assets.emergentagent.com/job_deploy-restore-bug/artifacts/qdfvwkqw_image.png",
        "college": "ISB",
        "college_logo": "/api/images/img_9fb1019dbba0",
        "current_company": "BCG",
        "current_company_logo": "",
        "image_url": "https://customer-assets.emergentagent.com/job_deploy-restore-bug/artifacts/tkeul7wd_image.png",
        "testimonial": "The process is great, Gradnext team takes you through each step of the process in a detailed manner, is always open to discuss things on a short notice which helps clarifying crucial challenges across the way. The mentors are very experienced and greatly help polishing ones case solving skills.",
        "plan_subscribed": "Mid Mile",
        "rating": 5,
        "linkedin_url": "",
        "is_active": True,
        "show_on_pages": ['home', 'coaching', 'subscription'],
        "order": 2,
        "created_at": "2024-07-10T14:20:00Z"
    },
    {
        "id": "testimonial_02f4b7ee88de",
        "name": "Gautham Krishna",
        "position": "",
        "company_joined": "BCG",
        "company_joined_logo": "/api/images/img_8e9decb5ad9d",
        "college": "Duke",
        "college_logo": "",
        "current_company": "",
        "current_company_logo": "",
        "image_url": "/api/uploads/testimonials/45a4c10d.avif",
        "testimonial": "I have always had deep respect for Kashish, having seen his inspiring professional journey since our undergrad days. Knowing his standards and commitment, I was confident that Gradnext would be built with a genuine plan to deliver successful outcomes for consulting candidates. That conviction only grew stronger once I started working with him and his team.\n\nThe multiple casing sessions with Kashish were incredibly valuable - he helped me spot nuanced aspects of my casing style that could be sharpened further. Beyond cases, he also shared high-quality resources for behavioral interview prep and deeper casing frameworks, both of which turned out to be immensely helpful in the final stretch.\n\nWhat truly set this experience apart was the personalized support. Kashish connected me with one of his partners in this endeavor, who happened to have worked in the same regional office belt where I was interviewing. He not only pushed me in casing but also gave me an insider's perspective on the office, the typical case types, and even insights on the people I'd potentially work with. That context was invaluable - it helped me better tailor my approach, especially for behavioral questions, and made me feel much more confident heading into the interviews.\n\nI would wholeheartedly recommend Gradnext to anyone preparing for consulting interviews. The combination of structured guidance, insider insights, and genuine mentorship is rare - and it made a real difference in my journey.",
        "plan_subscribed": "Last Mile",
        "rating": 5,
        "linkedin_url": "",
        "is_active": True,
        "show_on_pages": ['home', 'coaching', 'subscription'],
        "order": 3,
        "created_at": "2026-02-04T21:43:52.167053"
    },
    {
        "id": "testimonial_7045fc77a94b",
        "name": "Mahika Nahata",
        "position": "",
        "company_joined": "BCG",
        "company_joined_logo": "/api/images/img_8e9decb5ad9d",
        "college": "HEC Paris",
        "college_logo": "/api/images/img_a11872712294",
        "current_company": "",
        "current_company_logo": "",
        "image_url": "/api/uploads/testimonials/ff5d0ada.avif",
        "testimonial": "Thank you so much team for helping me turn this into reality! \nGradnext is truly the best in the game, and it has been my absolute pleasure to be working with the team. None of this would've been possible without the team. The constant push & morale support really helped push through the hard days. \nThey're truly best in the game, thank you for helping me turn my dream into reality",
        "plan_subscribed": "Full Prep",
        "rating": 5,
        "linkedin_url": "",
        "is_active": True,
        "show_on_pages": ['home', 'coaching', 'subscription'],
        "order": 4,
        "created_at": "2026-02-04T21:47:29.895247"
    },
    {
        "id": "testimonial_f4d9f59e6d82",
        "name": "Aneesh Dubey",
        "position": "",
        "company_joined": "YCP",
        "company_joined_logo": "/api/images/img_4bf2ca3c0ef3",
        "college": "ISB",
        "college_logo": "/api/images/img_9fb1019dbba0",
        "current_company": "",
        "current_company_logo": "",
        "image_url": "/api/uploads/testimonials/777a99d5.avif",
        "testimonial": "The biggest strength is definitely the access to a large pool of consultants already working at top firms. You know they've been through the process themselves, so you can trust their feedback. Scheduling was also really smooth, even last-minute requests were handled very well. Another thing I really appreciated was how helpful the team outside of the interviewers has been. Kashish has been super supportive and always available whenever needed, and the overall admin team made the process feel very easy to navigate.",
        "plan_subscribed": "Mid Mile",
        "rating": 5,
        "linkedin_url": "",
        "is_active": True,
        "show_on_pages": ['home', 'coaching', 'subscription'],
        "order": 5,
        "created_at": "2026-02-04T21:50:41.906667"
    },
    {
        "id": "testimonial_55264e4f674a",
        "name": "Megha Aggarwal",
        "position": "",
        "company_joined": "BCG",
        "company_joined_logo": "/api/images/img_8e9decb5ad9d",
        "college": "ISB",
        "college_logo": "/api/images/img_9fb1019dbba0",
        "current_company": "",
        "current_company_logo": "",
        "image_url": "/api/uploads/testimonials/d17f1a1c.avif",
        "testimonial": "It has been very helpful. They all are very motivating and super invested in your success. The last minute sessions were very proactively scheduled.",
        "plan_subscribed": "Full Prep",
        "rating": 5,
        "linkedin_url": "",
        "is_active": True,
        "show_on_pages": ['home', 'coaching', 'subscription'],
        "order": 6,
        "created_at": "2026-02-04T21:51:38.888139"
    },
    {
        "id": "testimonial_4affb956f08f",
        "name": "Avni Shah",
        "position": "",
        "company_joined": "BCG",
        "company_joined_logo": "/api/images/img_8e9decb5ad9d",
        "college": "ISB",
        "college_logo": "/api/images/img_9fb1019dbba0",
        "current_company": "",
        "current_company_logo": "",
        "image_url": "/api/images/img_2d351c55f1c9",
        "testimonial": "Kashish was a true pillar of support throughout my prep process. I definitely owe a huge part of my convert to him!\n\nFrom resume reviews to case prep his inputs at each stage were truly pivotal and value adding.\n\nLine by line inputs in resume with detailed discussion on what we want to convey. Tailored feedback on cases with tracking of performance over time.\n\nKashish treats your prep journey as his own and is a great mentor to have by your side!",
        "plan_subscribed": "Full Prep",
        "rating": 5,
        "linkedin_url": "",
        "is_active": True,
        "show_on_pages": ['home', 'coaching', 'subscription'],
        "order": 7,
        "created_at": "2026-02-04T21:53:44.997923"
    },
    {
        "id": "testimonial_757c4855a40e",
        "name": "Himank Wadhwa",
        "position": "",
        "company_joined": "Accenture Strategy",
        "company_joined_logo": "/api/images/img_2edc4a89d5f4",
        "college": "XLRI",
        "college_logo": "",
        "current_company": "",
        "current_company_logo": "",
        "image_url": "/api/uploads/testimonials/4db006bd.avif",
        "testimonial": "The sessions were planned really well, with enough breadth and depth of case frameworks. Kashish and his team delivered sessions that were easy to grasp, engaging and genuinely insightful. His guidance on preparing cases with peers was instrumental in my interview prep journey. Will recommend gradnext for anyone who is looking for a structured program to learn the art of being MECE!",
        "plan_subscribed": "",
        "rating": 5,
        "linkedin_url": "",
        "is_active": True,
        "show_on_pages": ['home', 'coaching', 'subscription'],
        "order": 8,
        "created_at": "2026-02-04T21:56:35.932089"
    },
    {
        "id": "testimonial_f9b515006c74",
        "name": "Suyash Ranjan",
        "position": "",
        "company_joined": "Bain & Company",
        "company_joined_logo": "/api/images/img_eb3b5470e7f7",
        "college": "XLRI",
        "college_logo": "/api/images/img_90fd7e67370e",
        "current_company": "",
        "current_company_logo": "",
        "image_url": "/api/uploads/testimonials/26f9067c.avif",
        "testimonial": "Very helpful in terms of getting to know the areas to work upon and how exactly can I work upon them",
        "plan_subscribed": "",
        "rating": 5,
        "linkedin_url": "",
        "is_active": True,
        "show_on_pages": ["home", "coaching", "subscription"],
        "order": 9,
        "created_at": "2026-02-04T21:59:01.753941"
    },
    {
        "id": "testimonial_2e9ba2e31b4f",
        "name": "Anshul Saxena",
        "position": "",
        "company_joined": "BCG",
        "company_joined_logo": "/api/images/img_8e9decb5ad9d",
        "college": "LBS",
        "college_logo": "/api/images/img_526f325ce4c2",
        "current_company": "",
        "current_company_logo": "",
        "image_url": "/api/uploads/testimonials/ec2608f7.avif",
        "testimonial": "I had a great experience with gradnext! I was referred to gradnext by Mahika, who had worked with them and received an offer herself so proof of delivery was there. Bit of background on me, I had done multiple cases before, gotten to final rounds of MBB firms more than once but never got the offer.\nSo I joined initially on the mid mile prep journey with the aim of just doing mentor sessions. Eventually, after getting past the first round stages I decided to move on to the Full Prep where I got access to the recorded videos.\nThat was a game changer for me, as it essentially rewired how I approached cases. I went from using my own method that I collated from various resources to using GradNext's approach. I found it to be a very very useful resource which transformed the way I approached cases.\nThe mentor cases were helpful- some mentors more than others. They challenged me every case more and more pushing me to the edge, and giving solid feedback.\nThe casebooks from the resources were also very helpful in practice.\n\nAll in all, very happy with the program. Thanks a lot Kashish and team",
        "plan_subscribed": "Full Prep",
        "rating": 5,
        "linkedin_url": "",
        "is_active": True,
        "show_on_pages": ['home', 'coaching', 'subscription'],
        "order": 10,
        "created_at": "2026-02-04T22:00:00.671565"
    },
    {
        "id": "testimonial_2ed0a79fb846",
        "name": "Megan Valderio",
        "position": "",
        "company_joined": "EY Parthenon",
        "company_joined_logo": "/api/images/img_e3b3ec486779",
        "college": "Smith",
        "college_logo": "/api/images/img_b6200547f398",
        "current_company": "",
        "current_company_logo": "",
        "image_url": "/api/uploads/testimonials/8b0b959a.avif",
        "testimonial": "Kashish has been a mentor to me for the past two years. He's never failed to make time, despite the time difference, in case prepping and preparing me for different interviews at top consulting firms. His methodical and structured yet innovative approach to case interviews helped me secure my EY internship in the Business Consulting service line in Toronto. He has taken the time to review my resume and has offered tailored recruitment advice. His prompt responses and overall stellar experience in the field truly helps new grads like myself navigate the world of consulting.",
        "plan_subscribed": "Full Prep",
        "rating": 5,
        "linkedin_url": "",
        "is_active": True,
        "show_on_pages": ['home', 'coaching', 'subscription'],
        "order": 11,
        "created_at": "2026-02-04T22:01:02.417502"
    },
    {
        "id": "testimonial_12388accd81c",
        "name": "Anuj Balodi",
        "position": "",
        "company_joined": "BCG",
        "company_joined_logo": "/api/images/img_8e9decb5ad9d",
        "college": "FMS",
        "college_logo": "/api/images/img_e5f8302ccdb5",
        "current_company": "",
        "current_company_logo": "",
        "image_url": "/api/uploads/testimonials/6af48ad5.avif",
        "testimonial": "With just one week to prepare for my case and fit interviews, I knew I had to be strategic. Having been out of touch with case solving for over 1.5 years since graduating from B-school, I needed a high-impact solution that prioritized quality over quantity. That's when I came across Gradnext and decided to enroll in their Last Mile Prep course. The program provided top-notch mock case interviews with experienced interviewers from top-tier consulting firms across various seniority levels. Each session was tailored to refine my approach, identify my weaknesses, and build my confidence.\n\nWhat truly sets Gradnext apart is the personalized mentorship. A huge shoutout to Kashish for his exceptional guidance and customized feedback at every step—even up until the final stage of my interview. His support made all the difference. If you're serious about breaking into your dream consulting firm, I couldn't recommend Gradnext more!",
        "plan_subscribed": "Last Mile",
        "rating": 5,
        "linkedin_url": "",
        "is_active": True,
        "show_on_pages": ['home', 'coaching', 'subscription'],
        "order": 12,
        "created_at": "2026-02-04T22:06:05.402762"
    },
    {
        "id": "testimonial_e5dbe10b9146",
        "name": "Raika",
        "position": "",
        "company_joined": "BCG",
        "company_joined_logo": "/api/images/img_8e9decb5ad9d",
        "college": "",
        "college_logo": "",
        "current_company": "",
        "current_company_logo": "",
        "image_url": "/api/uploads/testimonials/0c1f000a.avif",
        "testimonial": "gradnext was a huge help in my consulting prep journey. Their mock interviews gave me the structure and confidence I needed, and the detailed feedback helped me improve with each session. What I appreciated most was how flexible and accommodating they were with my schedule - it made the whole process so much easier. If you're looking for solid prep with a supportive team that really cares, I highly recommend them!",
        "plan_subscribed": "",
        "rating": 5,
        "linkedin_url": "",
        "is_active": True,
        "show_on_pages": ['home', 'coaching', 'subscription'],
        "order": 13,
        "created_at": "2026-02-04T22:07:16.251049"
    },
    {
        "id": "testimonial_438750808d65",
        "name": "Rabjeet Chhabra",
        "position": "",
        "company_joined": "Deecon",
        "company_joined_logo": "/api/images/img_0158152a1c07",
        "college": "LSE",
        "college_logo": "/api/images/img_5cf730accc07",
        "current_company": "",
        "current_company_logo": "",
        "image_url": "/api/uploads/testimonials/2218db7e.avif",
        "testimonial": "I think each consultant was different and had a different approach so the tips and strategies were very unique and showed a personal journey. The schedule was very adaptive to my preferences. The response times were quick and very need specific, I have an interview so the intensity was increased.\nI loved mentor's structure to the whole call",
        "plan_subscribed": "Full Prep",
        "rating": 5,
        "linkedin_url": "",
        "is_active": True,
        "show_on_pages": ['home', 'coaching', 'subscription'],
        "order": 14,
        "created_at": "2026-02-04T22:08:35.966943"
    },
    {
        "id": "testimonial_352d5be5263b",
        "name": "Radha Hardas",
        "position": "",
        "company_joined": "Accenture Strategy",
        "company_joined_logo": "/api/images/img_2edc4a89d5f4",
        "college": "",
        "college_logo": "",
        "current_company": "",
        "current_company_logo": "",
        "image_url": "/api/uploads/testimonials/d0eaeedd.avif",
        "testimonial": "1. Really appreciate the over delivery of a session towards the end\n2. Kashish genuinely cared about helping and wanting to see me do well which really stood out to me\n3. Immensely grateful towards the team for their mentorship",
        "plan_subscribed": "Last Mile",
        "rating": 5,
        "linkedin_url": "",
        "is_active": True,
        "show_on_pages": ['home', 'coaching', 'subscription'],
        "order": 15,
        "created_at": "2026-02-04T22:10:23.759945"
    },
    {
        "id": "testimonial_e173351605e6",
        "name": "Kanika",
        "position": "",
        "company_joined": "Arthur D. Little",
        "company_joined_logo": "/api/images/img_e6d07a12e7fa",
        "college": "",
        "college_logo": "",
        "current_company": "",
        "current_company_logo": "",
        "image_url": "/api/uploads/testimonials/33483cf7.avif",
        "testimonial": "Thanks Gradnext team for all preparation for interviews - building my concepts and practising with me various case interviews. It helped build my muscle and confidence for cases which I had completely lost touch. I loved\n- Rigour in feedback and continuity in development\n- Great set of resources for practice and basic foundations\n- Diligence in terms of follow up regarding job interview selection process and case practice sessions",
        "plan_subscribed": "Mid Mile",
        "rating": 5,
        "linkedin_url": "",
        "is_active": True,
        "show_on_pages": ['home', 'coaching', 'subscription'],
        "order": 16,
        "created_at": "2026-02-04T22:11:37.743404"
    },
    {
        "id": "testimonial_76bb82821558",
        "name": "Prabhnoor Bhatia",
        "position": "",
        "company_joined": "BCG",
        "company_joined_logo": "/api/images/img_8e9decb5ad9d",
        "college": "ISB",
        "college_logo": "/api/images/img_9fb1019dbba0",
        "current_company": "",
        "current_company_logo": "",
        "image_url": "/api/images/img_4d279b149a9a",
        "testimonial": "gradnext and the whole team have been super supportive throughout the case preparation phase. Kashish understands your needs and connects you with the right mentors who not only help refine your skills but also guide you in building confidence and approaching cases strategically. The case preparation with Gradnext provides a well-structured set of cases covering a wide variety of scenarios, ensuring thorough preparation. Learning from mentors with real-life experience makes a big difference, helping you refine your thinking and problem-solving approach. Alongside your preparation Kashish is always just a ping away, ready to answer your queries and share valuable tips to help you improve.",
        "plan_subscribed": "Full Prep",
        "rating": 5,
        "linkedin_url": "",
        "is_active": True,
        "show_on_pages": ['home', 'coaching', 'subscription'],
        "order": 17,
        "created_at": "2026-02-04T22:16:04.770761"
    },
    {
        "id": "testimonial_67d3ae4d5409",
        "name": "Pranav Kapoor",
        "position": "",
        "company_joined": "Mastercard Advisors",
        "company_joined_logo": "/api/images/img_f98db991abe9",
        "college": "ISB",
        "college_logo": "/api/images/img_9fb1019dbba0",
        "current_company": "",
        "current_company_logo": "",
        "image_url": "/api/uploads/testimonials/e1fed837.avif",
        "testimonial": "When a sudden interview invitation came my way, I knew I needed to get back into interview shape quickly. Even with my past consulting experience and MBA case prep, I felt quite rusty. My friends weren't able to squeeze in mock interviews on such short notice, so I reached out to Gradnext. They connected me with interviewers perfectly suited to my background and the company I was targeting. After just five mock interviews over about four days, my confidence soared. Thanks to that focused practice, I successfully landed the offer and have now joined the firm. I genuinely recommend Gradnext to anyone in a similar situation.",
        "plan_subscribed": "Last Mile",
        "rating": 5,
        "linkedin_url": "",
        "is_active": True,
        "show_on_pages": ['home', 'coaching', 'subscription'],
        "order": 18,
        "created_at": "2026-02-04T22:17:11.461124"
    },
    {
        "id": "testimonial_f5b951b332a8",
        "name": "Karthik Ramasubramanian",
        "position": "",
        "company_joined": "BCG",
        "company_joined_logo": "/api/images/img_8e9decb5ad9d",
        "college": "Christ University",
        "college_logo": "/api/images/img_c0292d9ec903",
        "current_company": "",
        "current_company_logo": "",
        "image_url": "/api/uploads/testimonials/6702fe1b.avif",
        "testimonial": "Kashish and the whole grad next helped me from step 1, in the process of building confidence and they gave me the competitive edge over the rest of my cohort. Really grateful to all of them.",
        "plan_subscribed": "Full Prep",
        "rating": 5,
        "linkedin_url": "",
        "is_active": True,
        "show_on_pages": ['home', 'coaching', 'subscription'],
        "order": 19,
        "created_at": "2026-02-04T22:20:17.891533"
    },
    {
        "id": "testimonial_2a4fb7088ee5",
        "name": "Sumona Nag",
        "position": "",
        "company_joined": "BCG",
        "company_joined_logo": "/api/images/img_8e9decb5ad9d",
        "college": "IIM K",
        "college_logo": "/api/images/img_e68d16f2bb96",
        "current_company": "",
        "current_company_logo": "",
        "image_url": "/api/uploads/testimonials/d00b7256.avif",
        "testimonial": "Kashish conducted mock case interviews for me. The cases were challenging and very similar to what is asked in actual MDP/Partner rounds at MBB. This is especially helpful if you want to refine your approach beyond the standard frameworks presented in case books. The feedback provided was very detailed and helped me to improve my structuring, drill down speed as well as the final recommendations.",
        "plan_subscribed": "",
        "rating": 5,
        "linkedin_url": "",
        "is_active": True,
        "show_on_pages": ['home', 'coaching', 'subscription'],
        "order": 20,
        "created_at": "2026-02-04T22:21:43.398612"
    },
    {
        "id": "testimonial_308e3ff0ca4f",
        "name": "Vinay Mehta",
        "position": "",
        "company_joined": "McKinsey & Company",
        "company_joined_logo": "/api/images/img_33080662aa95",
        "college": "IIM Calcutta",
        "college_logo": "/api/images/img_032c4a4f8c8d",
        "current_company": "",
        "current_company_logo": "",
        "image_url": "/api/uploads/testimonials/75115c3e.avif",
        "testimonial": "I got the offer from McKinsey! The last 2 weeks were nothing short of momentous with lots of highs and lows, I'm really glad I made that leap of faith and called you up, each case and call with you encouraged me through the last mile to now when I have an offer!",
        "plan_subscribed": "Last Mile",
        "rating": 5,
        "linkedin_url": "",
        "is_active": True,
        "show_on_pages": ['home', 'coaching', 'subscription'],
        "order": 21,
        "created_at": "2026-02-04T22:22:40.289764"
    },
    {
        "id": "testimonial_951ab9d5593d",
        "name": "Ananya",
        "position": "",
        "company_joined": "Bain & Company",
        "company_joined_logo": "/api/images/img_eb3b5470e7f7",
        "college": "XLRI",
        "college_logo": "",
        "current_company": "",
        "current_company_logo": "",
        "image_url": "/api/uploads/testimonials/e90b9e4b.avif",
        "testimonial": "The experience was extremely helpful. The mentor communicated my weaknesses and strength in depth. He also provided me with useful insights",
        "plan_subscribed": "",
        "rating": 5,
        "linkedin_url": "",
        "is_active": True,
        "show_on_pages": ['home', 'coaching', 'subscription'],
        "order": 22,
        "created_at": "2026-02-04T22:23:43.040699"
    },
    {
        "id": "testimonial_1b5ece9c8f7e",
        "name": "Harsh Nagle",
        "position": "",
        "company_joined": "Bain & Company",
        "company_joined_logo": "/api/images/img_eb3b5470e7f7",
        "college": "XLRI",
        "college_logo": "",
        "current_company": "",
        "current_company_logo": "",
        "image_url": "/api/images/img_659468565208",
        "testimonial": "Gradnext has been super helpful, I did a few cases with the team and appreciated the detailed feedback. I only had a couple of days to prepare for my first interview and I appreciate the flexibility of the team to help me prepare. Mentors were excellent and the dashboard was super helpful in reviewing the cases.",
        "plan_subscribed": "Full Prep",
        "rating": 5,
        "linkedin_url": "",
        "is_active": True,
        "show_on_pages": ['home', 'coaching', 'subscription'],
        "order": 23,
        "created_at": "2026-02-04T22:24:47.319199"
    },
    {
        "id": "testimonial_0820602d55e4",
        "name": "Vamsi Teja",
        "position": "",
        "company_joined": "BCG",
        "company_joined_logo": "/api/images/img_8e9decb5ad9d",
        "college": "IIM Calcutta",
        "college_logo": "/api/images/img_032c4a4f8c8d",
        "current_company": "",
        "current_company_logo": "",
        "image_url": "/api/images/img_f88b3eb88f1b",
        "testimonial": "It's a very smooth experience. The major advantage with the program is the availability of quality resources for casing with streamlined process. Given my busy schedules made it easier for me to gain access to the relevant resources with minimum efforts.",
        "plan_subscribed": "Full Prep",
        "rating": 5,
        "linkedin_url": "",
        "is_active": True,
        "show_on_pages": ['home', 'coaching', 'subscription'],
        "order": 24,
        "created_at": "2026-02-04T22:25:45.326486"
    },
    {
        "id": "testimonial_40bda94ea81a",
        "name": "Mayank Medhavi",
        "position": "",
        "company_joined": "YCP",
        "company_joined_logo": "/api/images/img_4bf2ca3c0ef3",
        "college": "IIM Calcutta",
        "college_logo": "/api/images/img_032c4a4f8c8d",
        "current_company": "",
        "current_company_logo": "",
        "image_url": "/api/images/img_7c3af97af6ae",
        "testimonial": "As someone who used to underestimate himself at every point & dealt with the infamous impostor syndrome, the journey with the GradNext team has been a transformational one. From the mentor case sessions to Kashish's personal support at every step, I was able to make my dream a reality.\nMoving forward, I know that my problem-solving abilities have improved over the course of the Full Prep Plus program at GradNext. I'm a curious, more confident individual who's now ready to take his first step in the world of consulting!\nThank you, and shoutout to everyone in the team for making this possible!",
        "plan_subscribed": "Full Prep",
        "rating": 5,
        "linkedin_url": "",
        "is_active": True,
        "show_on_pages": ['home', 'coaching', 'subscription'],
        "order": 25,
        "created_at": "2026-02-04T22:27:08.985006"
    },
    {
        "id": "testimonial_dea9df7327d1",
        "name": "Vaibhav Sinha",
        "position": "",
        "company_joined": "BCG",
        "company_joined_logo": "/api/images/img_8e9decb5ad9d",
        "college": "ISB",
        "college_logo": "/api/images/img_9fb1019dbba0",
        "current_company": "",
        "current_company_logo": "",
        "image_url": "/api/images/img_78d372239ffc",
        "testimonial": "Great experience with Gradnext. I'd strongly recommend it to anyone looking to sharpen their case and interview skills.\n\nWhat stood out:\n- Clear, actionable feedback after every case\n- Mentors who provide sharp, to-the-point insights\n- Smooth and efficient mock-scheduling process\n\nCredit to Gradnext for helping me crack my interviews. I'm sure there are many more success stories on the way!",
        "plan_subscribed": "Full Prep",
        "rating": 5,
        "linkedin_url": "",
        "is_active": True,
        "show_on_pages": ['home', 'coaching', 'subscription'],
        "order": 26,
        "created_at": "2026-02-04T22:28:05.906525"
    },
    {
        "id": "testimonial_01cfa808092e",
        "name": "Mohit Jain",
        "position": "",
        "company_joined": "BCG",
        "company_joined_logo": "/api/images/img_8e9decb5ad9d",
        "college": "Christ University",
        "college_logo": "/api/images/img_c0292d9ec903",
        "current_company": "",
        "current_company_logo": "",
        "image_url": "/api/uploads/testimonials/c107e7e0.avif",
        "testimonial": "The session was well-structured, making it easy to follow and understand. Kashish provided clear, targeted answers to each question, guiding me toward the right approach and helping me understand the rationale behind it.\n\nI feel confident that I made the right choice by choosing and paying for this session. For anyone seeking clarity in consulting, this session is exactly what I needed. I'd say I truly bet on the right horse.",
        "plan_subscribed": "",
        "rating": 5,
        "linkedin_url": "",
        "is_active": True,
        "show_on_pages": ['home', 'coaching', 'subscription'],
        "order": 27,
        "created_at": "2026-02-04T22:29:48.545213"
    },
    {
        "id": "testimonial_c1093d4367c4",
        "name": "Jasmeet Kaur",
        "position": "",
        "company_joined": "Accenture Strategy",
        "company_joined_logo": "/api/images/img_2edc4a89d5f4",
        "college": "",
        "college_logo": "",
        "current_company": "",
        "current_company_logo": "",
        "image_url": "/api/uploads/testimonials/cd872572.avif",
        "testimonial": "Kashish and the team are truly the best mentors anyone could have for consulting prep. Every session with them was filled with valuable insights and learnings. They made sure that my concepts were crystal clear, and I felt fully prepared for my D-day.\nKashish personally designed my preparation schedule, tailored specifically to my performance level. The team ensured I was exposed to a wide range of cases, and I gained complete clarity in my approach. Special attention was given to my weak areas, and they consistently worked on building my confidence, which I struggled with at first. Every day, they encouraged me and stood by me until the very end.\nThis team will always have a special place in my heart. I am deeply grateful to all of you.",
        "plan_subscribed": "Full Prep",
        "rating": 5,
        "linkedin_url": "",
        "is_active": True,
        "show_on_pages": ['home', 'coaching', 'subscription'],
        "order": 28,
        "created_at": "2026-02-04T22:31:03.022847"
    }
]


# Case drills data
drills_data = [
    {"id": "drill-1", "title": "Mental Math: Percentages", "category": "Mental Math", "difficulty": "beginner", "duration": "5 min", "description": "Quick percentage calculations", "is_free": True},
    {"id": "drill-2", "title": "Mental Math: Growth Rates", "category": "Mental Math", "difficulty": "beginner", "duration": "5 min", "description": "Calculate CAGR and growth rates", "is_free": True},
    {"id": "drill-3", "title": "Chart Analysis: Bar Charts", "category": "Data Interpretation", "difficulty": "beginner", "duration": "10 min", "description": "Extract insights from bar charts", "is_free": True},
    {"id": "drill-4", "title": "Mental Math: Large Numbers", "category": "Mental Math", "difficulty": "intermediate", "duration": "10 min", "description": "Operations with large numbers", "is_free": False},
    {"id": "drill-5", "title": "Chart Analysis: Line Graphs", "category": "Data Interpretation", "difficulty": "intermediate", "duration": "10 min", "description": "Trend analysis from line graphs", "is_free": False},
    {"id": "drill-6", "title": "Market Sizing: Consumer Products", "category": "Market Sizing", "difficulty": "intermediate", "duration": "15 min", "description": "Estimate market size for FMCG", "is_free": False},
    {"id": "drill-7", "title": "Profitability: Quick Analysis", "category": "Framework Application", "difficulty": "intermediate", "duration": "15 min", "description": "Identify profit levers quickly", "is_free": False},
    {"id": "drill-8", "title": "Market Sizing: B2B Services", "category": "Market Sizing", "difficulty": "advanced", "duration": "20 min", "description": "Complex B2B market estimation", "is_free": False},
    {"id": "drill-9", "title": "Timed Mini Case", "category": "Time-bound Cases", "difficulty": "advanced", "duration": "25 min", "description": "Complete case under time pressure", "is_free": False},
    {"id": "drill-10", "title": "Data-Heavy Case", "category": "Data Interpretation", "difficulty": "advanced", "duration": "20 min", "description": "Analyze complex datasets", "is_free": False}
]

# Case interview materials
materials_data = [
    {"id": "mat-1", "title": "Harvard Business School Casebook", "category": "Casebook", "description": "50+ cases from HBS consulting club", "file_url": "https://example.com/hbs-casebook.pdf", "is_free": True},
    {"id": "mat-2", "title": "Wharton Casebook 2024", "category": "Casebook", "description": "Latest cases from Wharton consulting club", "file_url": "https://example.com/wharton-casebook.pdf", "is_free": True},
    {"id": "mat-3", "title": "Framework Cheat Sheet", "category": "Template", "description": "Quick reference for all major frameworks", "file_url": "https://example.com/frameworks.pdf", "is_free": True},
    {"id": "mat-4", "title": "MBB CV Template", "category": "Template", "description": "Proven CV format that gets callbacks", "file_url": "https://example.com/cv-template.docx", "is_free": True},
    {"id": "mat-5", "title": "Cover Letter Templates", "category": "Template", "description": "5 compelling cover letter examples", "file_url": "https://example.com/cover-letters.pdf", "is_free": True},
    {"id": "mat-6", "title": "LinkedIn Outreach Templates", "category": "Template", "description": "Effective networking message templates", "file_url": "https://example.com/linkedin-templates.pdf", "is_free": True},
    {"id": "mat-7", "title": "Industry Primer: Tech", "category": "Industry Primer", "description": "Key metrics and trends in tech industry", "file_url": "https://example.com/tech-primer.pdf", "is_free": True},
    {"id": "mat-8", "title": "Industry Primer: Healthcare", "category": "Industry Primer", "description": "Healthcare industry overview", "file_url": "https://example.com/healthcare-primer.pdf", "is_free": True},
    {"id": "mat-9", "title": "Fit Interview Question Bank", "category": "Guide", "description": "100+ behavioral interview questions", "file_url": "https://example.com/fit-questions.pdf", "is_free": True},
    {"id": "mat-10", "title": "Mental Math Practice Book", "category": "Guide", "description": "500+ mental math problems", "file_url": "https://example.com/mental-math.pdf", "is_free": True}
]

# Subscription and Coaching Plans - Admin-managed, seeded once and never overwritten
plans_data = [
    # Free Trial Plan
    {
        "plan_key": "free_trial",
        "name": "Free Trial",
        "category": "subscription",
        "is_visible": False,
        "is_active": True,
        "is_hidden": True,
        "validity_months": 1,
        "features": {
            "course_recordings": True,
            "course_recordings_limited": True,
            "drills_exercises": True,
            "drills_limited": True,
            "case_materials": True,
            "case_materials_limited": True,
            "workshops": "none",
            "workshops_limited": False,
            "peer_sessions_per_month": 1,
            "coaching_sessions": 0,
            "strategy_calls": 0,
            "dedicated_coach": False,
            "priority_support": False,
            "industry_primers": False,
            "knowledge_sessions": False
        },
        "pricing": {
            "one_month": 0,
            "six_month": 0,
            "one_time": 0
        },
        "currency": "INR",
        "show_on_pages": ["home"],
        "auto_add_to_subscription": False,
        "requires_base_plan": False,
        "order": 0
    },
    # Basic Plan
    {
        "plan_key": "basic_plan",
        "name": "Basic Plan",
        "category": "subscription",
        "is_visible": True,
        "is_active": True,
        "is_hidden": False,
        "validity_months": None,
        "features": {
            "course_recordings": True,
            "course_recordings_limited": False,
            "drills_exercises": True,
            "drills_limited": False,
            "case_materials": True,
            "case_materials_limited": False,
            "workshops": "none",
            "workshops_limited": False,
            "peer_sessions_per_month": 2,
            "coaching_sessions": 0,
            "strategy_calls": 0,
            "dedicated_coach": False,
            "priority_support": False,
            "industry_primers": False,
            "knowledge_sessions": False
        },
        "pricing": {
            "one_month": 499,
            "six_month": 399,
            "one_time": None
        },
        "currency": "INR",
        "description": "",
        "display_features": [],
        "highlight": False,
        "badge": "",
        "order": 1,
        "show_on_pages": ["home"],
        "auto_add_to_subscription": False,
        "requires_base_plan": False,
        "application_only": False,
        "is_auto_renew": False
    },
    # Pro Plan
    {
        "plan_key": "pro_plan",
        "name": "Pro Plan",
        "category": "subscription",
        "is_visible": True,
        "is_active": True,
        "is_hidden": False,
        "validity_months": None,
        "features": {
            "course_recordings": True,
            "course_recordings_limited": False,
            "drills_exercises": True,
            "drills_limited": False,
            "case_materials": True,
            "case_materials_limited": False,
            "workshops": "only_recorded",
            "workshops_limited": False,
            "peer_sessions_per_month": 4,
            "coaching_sessions": 0,
            "strategy_calls": 0,
            "dedicated_coach": False,
            "priority_support": False,
            "industry_primers": True,
            "knowledge_sessions": True
        },
        "pricing": {
            "one_month": 699,
            "six_month": 599,
            "one_time": None
        },
        "currency": "INR",
        "description": "",
        "display_features": [],
        "highlight": False,
        "badge": "",
        "order": 2,
        "show_on_pages": ["home"],
        "auto_add_to_subscription": False,
        "requires_base_plan": False,
        "application_only": False,
        "is_auto_renew": False
    },
    # Pro+ Plan
    {
        "plan_key": "pro_plus",
        "name": "Pro+",
        "category": "subscription",
        "is_visible": True,
        "is_active": True,
        "is_hidden": False,
        "validity_months": None,
        "features": {
            "course_recordings": True,
            "course_recordings_limited": False,
            "drills_exercises": True,
            "drills_limited": False,
            "case_materials": True,
            "case_materials_limited": False,
            "workshops": "recorded_and_live",
            "workshops_limited": False,
            "peer_sessions_per_month": -1,
            "coaching_sessions": 0,
            "strategy_calls": 0,
            "dedicated_coach": False,
            "priority_support": False,
            "industry_primers": True,
            "knowledge_sessions": True
        },
        "pricing": {
            "one_month": 999,
            "six_month": 899,
            "one_time": None
        },
        "currency": "INR",
        "description": "",
        "display_features": [],
        "highlight": True,
        "badge": "Most Popular",
        "order": 3,
        "show_on_pages": ["home"],
        "auto_add_to_subscription": False,
        "requires_base_plan": False,
        "application_only": False,
        "is_auto_renew": False
    },
    # Coaching - Last Mile
    {
        "plan_key": "last_mile",
        "name": "Last Mile",
        "category": "coaching",
        "is_visible": True,
        "is_active": True,
        "is_hidden": False,
        "validity_months": 2,
        "features": {
            "course_recordings": True,
            "course_recordings_limited": False,
            "drills_exercises": True,
            "drills_limited": False,
            "case_materials": True,
            "case_materials_limited": False,
            "workshops": "recorded_and_live",
            "workshops_limited": False,
            "peer_sessions_per_month": -1,
            "coaching_sessions": 5,
            "strategy_calls": 1,
            "dedicated_coach": False,
            "priority_support": False,
            "industry_primers": True,
            "knowledge_sessions": True
        },
        "pricing": {
            "one_month": None,
            "six_month": None,
            "one_time": 16999
        },
        "currency": "INR",
        "description": "Ideal for those in the final stages of consulting interviews, aiming to refine the interview skills.",
        "display_features": [],
        "duration_months": 2,
        "highlight": False,
        "badge": "",
        "order": 1,
        "show_on_pages": ["home"],
        "auto_add_to_subscription": False,
        "requires_base_plan": False,
        "application_only": False,
        "is_auto_renew": False
    },
    # Coaching - Mid Mile
    {
        "plan_key": "mid_mile",
        "name": "Mid Mile",
        "category": "coaching",
        "is_visible": True,
        "is_active": True,
        "is_hidden": False,
        "validity_months": 3,
        "features": {
            "course_recordings": True,
            "course_recordings_limited": False,
            "drills_exercises": True,
            "drills_limited": False,
            "case_materials": True,
            "case_materials_limited": False,
            "workshops": "recorded_and_live",
            "workshops_limited": False,
            "peer_sessions_per_month": -1,
            "coaching_sessions": 10,
            "strategy_calls": 2,
            "dedicated_coach": False,
            "priority_support": False,
            "industry_primers": True,
            "knowledge_sessions": True
        },
        "pricing": {
            "one_month": None,
            "six_month": None,
            "one_time": 31999
        },
        "currency": "INR",
        "description": "Ideal for those in the early stages of preparation, looking to improve their consulting interview skills.",
        "display_features": [],
        "duration_months": 3,
        "highlight": False,
        "badge": "",
        "order": 2,
        "show_on_pages": ["home"],
        "auto_add_to_subscription": False,
        "requires_base_plan": False,
        "application_only": False,
        "is_auto_renew": False
    },
    # Coaching - Full Prep
    {
        "plan_key": "full_prep",
        "name": "Full Prep",
        "category": "coaching",
        "is_visible": True,
        "is_active": True,
        "is_hidden": False,
        "validity_months": 6,
        "features": {
            "course_recordings": True,
            "course_recordings_limited": False,
            "drills_exercises": True,
            "drills_limited": False,
            "case_materials": True,
            "case_materials_limited": False,
            "workshops": "recorded_and_live",
            "workshops_limited": False,
            "peer_sessions_per_month": -1,
            "coaching_sessions": 15,
            "strategy_calls": 3,
            "dedicated_coach": True,
            "priority_support": True,
            "industry_primers": True,
            "knowledge_sessions": True
        },
        "pricing": {
            "one_month": None,
            "six_month": None,
            "one_time": 44999
        },
        "currency": "INR",
        "description": "Ideal for those who are starting from the scratch and looking to master their consulting interview skills.",
        "display_features": ["Dedicated MBB Coach", "Priority WhatsApp + Call Access"],
        "duration_months": 6,
        "highlight": True,
        "badge": "Most Popular",
        "order": 3,
        "show_on_pages": ["home"],
        "auto_add_to_subscription": False,
        "requires_base_plan": False,
        "application_only": False,
        "is_auto_renew": False
    },
    # Coaching - Pinnacle
    {
        "plan_key": "pinnacle",
        "name": "Pinnacle",
        "category": "coaching",
        "is_visible": True,
        "is_active": True,
        "is_hidden": False,
        "validity_months": 6,
        "features": {
            "course_recordings": True,
            "course_recordings_limited": False,
            "drills_exercises": True,
            "drills_limited": False,
            "case_materials": True,
            "case_materials_limited": False,
            "workshops": "recorded_and_live",
            "workshops_limited": False,
            "peer_sessions_per_month": -1,
            "coaching_sessions": -1,
            "strategy_calls": -1,
            "dedicated_coach": True,
            "priority_support": True,
            "industry_primers": True,
            "knowledge_sessions": True
        },
        "pricing": {
            "one_month": None,
            "six_month": None,
            "one_time": 0
        },
        "currency": "INR",
        "description": "Ideal for those seeking personalized, structured consulting coaching with dedicated coach, and round-the-clock guidance.",
        "display_features": ["Dedicated MBB Coach", "Priority WhatsApp + Call Access"],
        "duration_months": 6,
        "highlight": False,
        "badge": "",
        "order": 4,
        "show_on_pages": ["home"],
        "auto_add_to_subscription": False,
        "requires_base_plan": False,
        "application_only": True,
        "is_auto_renew": False
    },
    # Cohort Premium
    {
        "plan_key": "cohort_premium",
        "name": "Cohort Premium",
        "category": "cohort",
        "is_visible": True,
        "is_active": True,
        "is_hidden": False,
        "features": {
            "course_recordings": True,
            "course_recordings_limited": False,
            "drills_exercises": True,
            "drills_limited": False,
            "case_materials": True,
            "case_materials_limited": False,
            "workshops": "none",
            "workshops_limited": False,
            "peer_to_peer": "none",
            "coaching_sessions": 1,
            "strategy_calls": 1,
            "dedicated_coach": False
        },
        "pricing": {
            "one_month": None,
            "six_month": None,
            "one_time": None
        },
        "currency": "INR",
        "display_features": [],
        "order": 0,
        "highlight": False,
        "badge": None,
        "show_on_pages": ["home"],
        "auto_add_to_subscription": False,
        "requires_base_plan": False,
        "application_only": False,
        "is_auto_renew": False
    },
    # Cohort Elite
    {
        "plan_key": "cohort_elite",
        "name": "Cohort Elite",
        "category": "cohort",
        "is_visible": True,
        "is_active": True,
        "is_hidden": False,
        "features": {
            "course_recordings": True,
            "course_recordings_limited": False,
            "drills_exercises": True,
            "drills_limited": False,
            "case_materials": True,
            "case_materials_limited": False,
            "workshops": "none",
            "workshops_limited": False,
            "peer_to_peer": "none",
            "coaching_sessions": 3,
            "strategy_calls": 2,
            "dedicated_coach": False
        },
        "pricing": {
            "one_month": None,
            "six_month": None,
            "one_time": None
        },
        "currency": "INR",
        "display_features": [],
        "order": 0,
        "highlight": False,
        "badge": None,
        "show_on_pages": ["home"],
        "auto_add_to_subscription": False,
        "requires_base_plan": False,
        "application_only": False,
        "is_auto_renew": False
    },
    # Addon - Peer Session
    {
        "plan_key": "addon_peer_session",
        "name": "Peer-to-Peer Sessions",
        "category": "addon",
        "is_visible": True,
        "is_active": True,
        "is_hidden": False,
        "features": {
            "course_recordings": True,
            "course_recordings_limited": False,
            "drills_exercises": True,
            "drills_limited": False,
            "case_materials": True,
            "case_materials_limited": False,
            "workshops": "none",
            "workshops_limited": False,
            "peer_to_peer": "none",
            "coaching_sessions": 0,
            "strategy_calls": 0,
            "dedicated_coach": False
        },
        "pricing": {
            "one_month": None,
            "six_month": None,
            "one_time": None
        },
        "currency": "INR",
        "display_features": [],
        "order": 0,
        "highlight": False,
        "badge": None,
        "show_on_pages": ["home"],
        "auto_add_to_subscription": False,
        "requires_base_plan": False,
        "application_only": False,
        "is_auto_renew": False
    }
]

# Cohort sessions data
cohort_sessions_data = [
    {"id": "cohort-1", "batch": "Batch-2025-Q1", "week": 0, "title": "Ice-Breaker Session", "description": "Build connections with your cohort peers.", "date": "2025-01-06", "time": "7:00 PM IST", "duration": "1 hour", "is_past": True, "recording_url": "https://example.com/cohort1", "deck_url": "https://example.com/deck1.pdf", "meeting_link": None},
    {"id": "cohort-2", "batch": "Batch-2025-Q1", "week": 1, "title": "Building Consulting CV & Networking", "description": "Learn to construct MBB-style CVs and networking strategies.", "date": "2025-01-13", "time": "7:00 PM IST", "duration": "2 hours", "is_past": True, "recording_url": "https://example.com/cohort2", "deck_url": "https://example.com/deck2.pdf", "meeting_link": None},
    {"id": "cohort-3", "batch": "Batch-2025-Q1", "week": 2, "title": "How to Approach Case Interviews", "description": "Anatomy of a case interview and structuring approach.", "date": "2025-01-20", "time": "7:00 PM IST", "duration": "2 hours", "is_past": False, "recording_url": None, "deck_url": None, "meeting_link": "https://zoom.us/j/123456789"},
    {"id": "cohort-4", "batch": "Batch-2025-Q1", "week": 3, "title": "Profitability Framework", "description": "Deep dive into revenue and cost analysis.", "date": "2025-01-27", "time": "7:00 PM IST", "duration": "2 hours", "is_past": False, "recording_url": None, "deck_url": None, "meeting_link": "https://zoom.us/j/123456789"},
    {"id": "cohort-5", "batch": "Batch-2025-Q1", "week": 4, "title": "Market Entry Framework", "description": "Market assessment and entry strategies.", "date": "2025-02-03", "time": "7:00 PM IST", "duration": "2 hours", "is_past": False, "recording_url": None, "deck_url": None, "meeting_link": "https://zoom.us/j/123456789"},
    {"id": "cohort-6", "batch": "Batch-2025-Q1", "week": 5, "title": "Growth Framework", "description": "Ansoff Matrix and growth strategies.", "date": "2025-02-10", "time": "7:00 PM IST", "duration": "2 hours", "is_past": False, "recording_url": None, "deck_url": None, "meeting_link": "https://zoom.us/j/123456789"},
    {"id": "cohort-7", "batch": "Batch-2025-Q1", "week": 6, "title": "M&A Framework", "description": "Mergers & acquisitions fundamentals.", "date": "2025-02-17", "time": "7:00 PM IST", "duration": "2 hours", "is_past": False, "recording_url": None, "deck_url": None, "meeting_link": "https://zoom.us/j/123456789"},
    {"id": "cohort-8", "batch": "Batch-2025-Q1", "week": 7, "title": "Guesstimates & Pricing", "description": "Market sizing and pricing strategies.", "date": "2025-02-24", "time": "7:00 PM IST", "duration": "2 hours", "is_past": False, "recording_url": None, "deck_url": None, "meeting_link": "https://zoom.us/j/123456789"}
]

# Discovery Call Questions - Admin-managed, seeded once and never overwritten
discovery_call_questions_data = [
    {
        "id": "c611ccc2-1109-4138-92cb-ccd63a3a70c2",
        "question": "Your Name",
        "type": "short_text",
        "required": True,
        "options": [],
        "order": 0,
        "placeholder": "Enter your full name"
    },
    {
        "id": "2cec6464-f562-4ab4-b3b4-b581fbebbbcb",
        "question": "Current Location",
        "type": "short_text",
        "required": True,
        "options": [],
        "order": 1,
        "placeholder": "Country"
    },
    {
        "id": "2026606d-339a-4f42-b32c-8db246dab682",
        "question": "Email",
        "type": "email",
        "required": True,
        "options": [],
        "order": 2,
        "placeholder": "Enter your email address"
    },
    {
        "id": "e5e2f82a-8196-4463-923b-b43b7c27001c",
        "question": "Phone Number",
        "type": "phone",
        "required": True,
        "options": [],
        "order": 3,
        "placeholder": "+91 XXXXX XXXXX"
    },
    {
        "id": "5b62446e-66a1-4dea-a55d-2bc63af9116d",
        "question": "Undergraduate University",
        "type": "short_text",
        "required": True,
        "options": [],
        "order": 4,
        "placeholder": "Enter your undergraduate university"
    },
    {
        "id": "9e92ca9b-de08-42ba-88bb-61c4c6c23a6d",
        "question": "Postgraduate University (or if you have an admit from a college)",
        "type": "short_text",
        "required": False,
        "options": [],
        "order": 5,
        "placeholder": "Enter your postgraduate university or leave blank"
    },
    {
        "id": "77bd5abd-7a70-4e21-bd32-3c97d2962f00",
        "question": "Total Work Ex (in Months)",
        "type": "short_text",
        "required": True,
        "options": [],
        "order": 6,
        "placeholder": "e.g., 24"
    },
    {
        "id": "ee10b9ad-558d-4743-a9c4-dba4c7f6f83b",
        "question": "Latest Organisation",
        "type": "short_text",
        "required": True,
        "options": [],
        "order": 7,
        "placeholder": "Enter your current/latest employer"
    },
    {
        "id": "8210b3f4-9452-4614-b211-53a290253b88",
        "question": "Which one of the following best describes your current situation?",
        "type": "single_choice",
        "required": True,
        "options": [
            {"id": "f0c7f784-3425-40ca-b3c5-160b5977ec40", "label": "Started Preparing for Consulting Interviews", "value": "started_preparing_for_consulting_interviews"},
            {"id": "413a66ed-4f7b-4a8e-9b45-01ce470ae88b", "label": "Currently in Interview Process", "value": "interviewing"},
            {"id": "c6cc970a-fd29-4532-a414-48b76c549be4", "label": "Exploring Career Options", "value": "exploring"},
            {"id": "510f7d9b-5a28-4f2b-9665-17e2a9467dc5", "label": "Applying to Consulting Firms", "value": "applying_to_consulting_firms"}
        ],
        "order": 8,
        "placeholder": ""
    },
    {
        "id": "85e87909-ead0-4579-960c-88d927d62df7",
        "question": "If you are in an interview process, which firm?",
        "type": "short_text",
        "required": False,
        "options": [],
        "order": 9,
        "placeholder": "e.g., McKinsey, BCG, Bain"
    },
    {
        "id": "8f58f5b5-3c57-426a-b7f9-7a4b9df52794",
        "question": "What is your primary goal or expected outcome from working with us?",
        "type": "single_choice",
        "required": True,
        "options": [
            {"id": "76332f98-f8b5-4db1-b232-0986981bf90d", "label": "Get referral in my target firms", "value": "get_referral_in_my_target_firms"},
            {"id": "35d2343e-7f9a-4bc5-bea9-af1d8deae559", "label": "Prepare my CV (or applications)", "value": "prepare_my_cv_(or_applications)_"},
            {"id": "3217e58d-0eba-47a7-b946-2fc84f8afe08", "label": "Prepare for the interviews", "value": "prepare_for_the_interviews"}
        ],
        "order": 10,
        "placeholder": ""
    },
    {
        "id": "1f88c9dd-ae7e-44dd-9529-12a794b0bf1f",
        "question": "Which programme format do you think would be most suitable for you to achieve your goal?",
        "type": "single_choice",
        "required": True,
        "options": [
            {"id": "0abddfcd-1a8a-48c0-881f-3d6c8e259bef", "label": "One-on-one coaching", "value": "one-on-one_coaching_"},
            {"id": "c811145e-168d-42a5-8e41-bbfa5a1f92fc", "label": "Self-learning", "value": "self-learning_"},
            {"id": "8829ea6a-2d81-426f-8928-449948940bd5", "label": "Not sure yet", "value": "unsure"}
        ],
        "order": 11,
        "placeholder": ""
    },
    {
        "id": "d0b0911b-556d-4c0f-b49a-ad0f56507a5b",
        "question": "Anything you would like us to know?",
        "type": "long_text",
        "required": False,
        "options": [],
        "order": 13,
        "placeholder": "Share any additional information or questions..."
    },
    {
        "id": "8223f251-3860-4fa0-8ed2-d681307007a2",
        "question": "How did you hear about us?",
        "type": "single_choice",
        "required": True,
        "options": [
            {"id": "38f2d884-8d73-4d51-9355-3f05a3b7ee70", "label": "Google Search", "value": "google"},
            {"id": "1eb85e01-f953-4b64-8bfe-bce81a42bfeb", "label": "LinkedIn", "value": "linkedin"},
            {"id": "bc023447-5531-4793-8f44-dd43ab52d92e", "label": "Instagram", "value": "instagram"},
            {"id": "1cbc5079-1ad9-43ec-b771-ffda0f8240a4", "label": "Friend/Colleague Referral", "value": "referral"},
            {"id": "8f0e8810-7b51-491e-b38b-b44fb8890946", "label": "YouTube", "value": "youtube"},
            {"id": "3939f497-677b-492d-a8e1-a4b53a5c3619", "label": "Other", "value": "other"}
        ],
        "order": 14,
        "placeholder": ""
    }
]


def generate_mentor_availability():
    """Generate mentor availability for next 14 days"""
    availability = []
    base_date = datetime.now()
    
    time_slots = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00", "18:00"]
    
    for mentor in mentors_data:
        for day_offset in range(1, 15):
            date = base_date + timedelta(days=day_offset)
            if date.weekday() < 5:  # Weekdays only
                # Each mentor has random availability
                available_slots = random.sample(time_slots, k=random.randint(3, 6))
                availability.append({
                    "id": f"avail-{mentor['id']}-{date.strftime('%Y-%m-%d')}",
                    "mentor_id": mentor["id"],
                    "date": date.strftime("%Y-%m-%d"),
                    "time_slots": sorted(available_slots),
                    "booked_slots": []
                })
    
    return availability


async def create_indexes(db):
    """Create database indexes for optimal query performance.
    
    These indexes are critical for handling 5,000+ concurrent users.
    """
    print("Creating database indexes for scalability...")
    
    try:
        # Users collection - critical for authentication
        await db.users.create_index("id", unique=True, background=True)
        await db.users.create_index("email", unique=True, background=True)
        await db.users.create_index("plan", background=True)
        
        # Sessions collection - for authentication
        await db.sessions.create_index("token", unique=True, background=True)
        await db.sessions.create_index("user_id", background=True)
        await db.sessions.create_index("expires_at", expireAfterSeconds=0, background=True)
        
        # Peer profiles - for peer practice feature
        await db.peer_profiles.create_index("user_id", unique=True, background=True)
        await db.peer_profiles.create_index([("is_listed", 1), ("peer_rating", -1)], background=True)
        
        # Peer sessions - for booking and history
        await db.peer_sessions.create_index("id", unique=True, background=True)
        await db.peer_sessions.create_index([("requester_id", 1), ("date", 1)], background=True)
        await db.peer_sessions.create_index([("partner_id", 1), ("date", 1)], background=True)
        await db.peer_sessions.create_index([("status", 1), ("date", 1)], background=True)
        
        # Mentors and availability
        await db.mentors.create_index("id", unique=True, background=True)
        await db.mentors.create_index("is_active", background=True)
        await db.mentor_availability.create_index([("mentor_id", 1), ("date", 1)], background=True)
        
        # Coaching sessions
        await db.coaching_sessions.create_index("id", unique=True, background=True)
        await db.coaching_sessions.create_index([("user_id", 1), ("status", 1)], background=True)
        await db.coaching_sessions.create_index([("mentor_id", 1), ("date", 1)], background=True)
        
        # Plans - for pricing page
        await db.plans.create_index("plan_key", background=True)
        await db.plans.create_index([("category", 1), ("is_active", 1)], background=True)
        
        # Payments
        await db.payments.create_index("order_id", unique=True, background=True)
        await db.payments.create_index("user_id", background=True)
        
        # Videos and resources
        await db.videos.create_index("id", unique=True, background=True)
        await db.videos.create_index("course_id", background=True)
        await db.drills.create_index("id", unique=True, background=True)
        
        # User progress tracking
        await db.user_progress.create_index([("user_id", 1), ("video_id", 1)], unique=True, background=True)
        await db.drill_attempts.create_index([("user_id", 1), ("drill_id", 1)], background=True)
        
        print("Database indexes created successfully!")
        
    except Exception as e:
        print(f"Warning: Some indexes may already exist or failed to create: {e}")


async def seed_database(db):
    """Seed the database with initial data"""
    
    # Create indexes for performance (idempotent - safe to run multiple times)
    await create_indexes(db)
    
    # Always seed plans if they don't exist (independent check)
    await seed_default_plans(db)
    
    # Always seed discovery call questions if they don't exist (independent check)
    await seed_discovery_call_questions(db)
    
    # Always seed persistent images if they don't exist (logos, mentor photos, candidate photos)
    await seed_persistent_images(db)
    
    # Always seed logo repository if it doesn't exist
    await seed_logo_repository(db)
    
    # Always seed blog categories if they don't exist
    await seed_blog_categories(db)
    
    # Check if already seeded
    existing_mentors = await db.mentors.count_documents({})
    if existing_mentors > 0:
        print("Database already seeded, skipping...")
        # Still seed testimonials if they don't exist (separate from main seed check)
        await seed_default_testimonials(db)
        return
    
    print("Seeding database...")
    
    # Insert mentors
    await db.mentors.insert_many(mentors_data)
    print(f"Inserted {len(mentors_data)} mentors")
    
    # Insert videos
    await db.videos.insert_many(videos_data)
    print(f"Inserted {len(videos_data)} videos")
    
    # Insert workshops
    await db.workshops.insert_many(workshops_data)
    print(f"Inserted {len(workshops_data)} workshops")
    
    # Insert drills
    await db.drills.insert_many(drills_data)
    print(f"Inserted {len(drills_data)} drills")
    
    # Insert materials
    await db.materials.insert_many(materials_data)
    print(f"Inserted {len(materials_data)} materials")
    
    # Insert cohort sessions
    await db.cohort_sessions.insert_many(cohort_sessions_data)
    print(f"Inserted {len(cohort_sessions_data)} cohort sessions")
    
    # Insert default testimonials
    await seed_default_testimonials(db)
    
    # Generate and insert mentor availability
    availability = generate_mentor_availability()
    await db.mentor_availability.insert_many(availability)
    print(f"Inserted {len(availability)} availability slots")
    
    print("Database seeding complete!")


async def seed_default_testimonials(db):
    """
    Seed default testimonials if none exist.
    This runs independently from main seeding to ensure testimonials are always present.
    User-added testimonials are never overwritten.
    """
    existing_testimonials = await db.testimonials.count_documents({})
    
    if existing_testimonials > 0:
        print(f"Testimonials already exist ({existing_testimonials} found), skipping default testimonials...")
        return
    
    print(f"Seeding {len(testimonials_data)} default testimonials...")
    await db.testimonials.insert_many(testimonials_data)
    print(f"✅ Inserted {len(testimonials_data)} default testimonials")


async def seed_default_plans(db):
    """
    Seed default subscription and coaching plans if none exist.
    Plans are only seeded once and can be modified via admin panel.
    This ensures plans persist and are not overwritten on restart.
    """
    import uuid
    from datetime import datetime, timezone
    
    existing_plans = await db.plans.count_documents({})
    
    if existing_plans > 0:
        print(f"Plans already exist ({existing_plans} found), skipping default plans...")
        return
    
    print(f"Seeding {len(plans_data)} default plans...")
    
    # Add id and timestamps to each plan
    plans_to_insert = []
    for plan in plans_data:
        plan_with_meta = {
            "id": str(uuid.uuid4()),
            **plan,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        plans_to_insert.append(plan_with_meta)
    
    await db.plans.insert_many(plans_to_insert)
    print(f"✅ Inserted {len(plans_to_insert)} default plans")


async def seed_discovery_call_questions(db):
    """
    Seed default discovery call questions if none exist.
    Questions are only seeded once and can be modified via admin panel.
    This ensures questions persist and are not overwritten on restart.
    """
    existing_questions = await db.discovery_call_questions.count_documents({})
    
    if existing_questions > 0:
        print(f"Discovery call questions already exist ({existing_questions} found), skipping...")
        return
    
    print(f"Seeding {len(discovery_call_questions_data)} discovery call questions...")
    await db.discovery_call_questions.insert_many(discovery_call_questions_data)
    print(f"✅ Inserted {len(discovery_call_questions_data)} discovery call questions")



async def seed_persistent_images(db):
    """
    Seed persistent images (logos, mentor photos, candidate photos) from seed_images.json.
    Images are only seeded if the collection is empty.
    This ensures all photos and logos are available after database reset.
    """
    import json
    import os
    
    existing_images = await db.persistent_images.count_documents({})
    
    if existing_images > 0:
        print(f"Persistent images already exist ({existing_images} found), skipping...")
        return
    
    # Load images from JSON file
    seed_file = os.path.join(os.path.dirname(__file__), 'seed_images.json')
    
    if not os.path.exists(seed_file):
        print(f"⚠️ seed_images.json not found at {seed_file}, skipping image seeding...")
        return
    
    try:
        with open(seed_file, 'r') as f:
            images_data = json.load(f)
        
        if images_data:
            await db.persistent_images.insert_many(images_data)
            print(f"✅ Inserted {len(images_data)} persistent images (logos, mentor photos, candidate photos)")
        else:
            print("⚠️ seed_images.json is empty, no images to seed")
            
    except Exception as e:
        print(f"❌ Error seeding persistent images: {str(e)}")


async def seed_logo_repository(db):
    """
    Seed logo repository data from logo_repository collection.
    This contains metadata about company/college logos.
    """
    existing_logos = await db.logo_repository.count_documents({})
    
    if existing_logos > 0:
        print(f"Logo repository already exists ({existing_logos} found), skipping...")
        return
    
    # Logo repository data
    logo_repository_data = [
        {"id": "logo_3cd2323782ea", "name": "McKinsey & Company", "logo_url": "/api/images/img_33080662aa95", "category": "consulting_firm", "show_on_homepage": False},
        {"id": "logo_95dcecf7fb02", "name": "BCG", "logo_url": "/api/images/img_8e9decb5ad9d", "category": "consulting_firm", "show_on_homepage": False},
        {"id": "logo_370e0456e384", "name": "Bain & Company", "logo_url": "/api/images/img_eb3b5470e7f7", "category": "consulting_firm", "show_on_homepage": False},
        {"id": "logo_d97a46828d31", "name": "Arthur D. Little", "logo_url": "/api/images/img_e6d07a12e7fa", "category": "consulting_firm", "show_on_homepage": False},
        {"id": "logo_afc3414e0668", "name": "Accenture Strategy", "logo_url": "/api/images/img_2edc4a89d5f4", "category": "consulting_firm", "show_on_homepage": False},
        {"id": "logo_b92fc837ac5e", "name": "YCP", "logo_url": "/api/images/img_4bf2ca3c0ef3", "category": "consulting_firm", "show_on_homepage": False},
        {"id": "logo_98c5819dd6fb", "name": "LBS", "logo_url": "/api/images/img_526f325ce4c2", "category": "college", "show_on_homepage": False},
        {"id": "logo_9ec17e9195ce", "name": "ISB", "logo_url": "/api/images/img_9fb1019dbba0", "category": "college", "show_on_homepage": False},
        {"id": "logo_60476c7e1c1b", "name": "IIM Calcutta", "logo_url": "/api/images/img_032c4a4f8c8d", "category": "college", "show_on_homepage": False},
        {"id": "logo_3a9820b9235a", "name": "HEC Paris", "logo_url": "/api/images/img_a11872712294", "category": "college", "show_on_homepage": False},
        {"id": "logo_6128592b0769", "name": "Texas A&M", "logo_url": "/api/images/img_4d84f8d524e6", "category": "college", "show_on_homepage": False},
        {"id": "logo_900c3c7ab7a8", "name": "XLRI", "logo_url": "/api/images/img_90fd7e67370e", "category": "college", "show_on_homepage": False},
        {"id": "logo_4d3ac561f1bc", "name": "Christ University", "logo_url": "/api/images/img_c0292d9ec903", "category": "college", "show_on_homepage": False},
        {"id": "logo_a3f64c4a3535", "name": "EY Parthenon", "logo_url": "/api/images/img_e3b3ec486779", "category": "consulting_firm", "show_on_homepage": False},
        {"id": "logo_394a50dffc71", "name": "LSE", "logo_url": "/api/images/img_5cf730accc07", "category": "college", "show_on_homepage": False},
        {"id": "logo_4f2652964f95", "name": "Smith", "logo_url": "/api/images/img_b6200547f398", "category": "college", "show_on_homepage": False},
        {"id": "logo_829c967de749", "name": "Deecon", "logo_url": "/api/images/img_0158152a1c07", "category": "company", "show_on_homepage": False},
        {"id": "logo_81410daf12c2", "name": "IIM K", "logo_url": "/api/images/img_e68d16f2bb96", "category": "college", "show_on_homepage": False},
        {"id": "logo_c5c894564f73", "name": "FMS", "logo_url": "/api/images/img_e5f8302ccdb5", "category": "college", "show_on_homepage": False},
        {"id": "logo_b46bc215ad29", "name": "Mastercard Advisors", "logo_url": "/api/images/img_f98db991abe9", "category": "consulting", "show_on_homepage": False},
    ]
    
    await db.logo_repository.insert_many(logo_repository_data)
    print(f"✅ Inserted {len(logo_repository_data)} logo repository entries")



async def seed_blog_categories(db):
    """Seed blog categories"""
    existing = await db.blog_categories.count_documents({})
    if existing > 0:
        print(f"⏭️ Skipping blog categories seed - {existing} categories exist")
        return
    
    categories = [
        {
            "id": "cat-case-interview",
            "name": "Case Interview",
            "slug": "case-interview",
            "description": "Tips, frameworks, and strategies for cracking consulting case interviews",
            "color": "#3B82F6"
        },
        {
            "id": "cat-consulting-tips",
            "name": "Consulting Tips",
            "slug": "consulting-tips",
            "description": "Insights and advice for aspiring and current consultants",
            "color": "#10B981"
        },
        {
            "id": "cat-success-stories",
            "name": "Success Stories",
            "slug": "success-stories",
            "description": "Inspiring journeys of candidates who made it to top consulting firms",
            "color": "#F59E0B"
        },
        {
            "id": "cat-company-news",
            "name": "Company News",
            "slug": "company-news",
            "description": "Latest updates and announcements from GradNext",
            "color": "#8B5CF6"
        },
        {
            "id": "cat-industry-insights",
            "name": "Industry Insights",
            "slug": "industry-insights",
            "description": "Trends and analysis from the consulting industry",
            "color": "#EC4899"
        }
    ]
    
    for cat in categories:
        cat["created_at"] = "2025-01-01T00:00:00Z"
    
    await db.blog_categories.insert_many(categories)
    print(f"✅ Seeded {len(categories)} blog categories")
