#!/usr/bin/env python3
"""
Visit Count API - Comprehensive Backend Test

Testing the Visit Count API endpoint:
- GET /api/tracking/visit-count
- POST /api/tracking/login (for creating daily_login events)
- Test case 1: Unauthenticated request (should return {"count": 0})
- Test case 2: Authenticated request (should return actual count)
- Test case 3: Track login then check count (should increment)
- Test case 4: Idempotent daily login (should not double-count same day)
"""

import asyncio
import sys
import os
import json
import logging
from datetime import datetime, timedelta, timezone
import aiohttp
from motor.motor_asyncio import AsyncIOMotorClient
import uuid

# Add current directory to Python path
sys.path.append('/app/backend')

# Load environment variables first
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Get backend URL from frontend env file
BACKEND_URL = "https://consultant-gateway.preview.emergentagent.com/api"

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'gradnext')

class VisitCountTest:
    def __init__(self):
        self.client = None
        self.db = None
        self.backend_url = BACKEND_URL
        self.test_results = {
            'database_connection': False,
            'test_user_setup': False,
            'unauthenticated_request': False,
            'authenticated_request_initial': False,
            'track_login_first': False,
            'visit_count_after_login': False,
            'track_login_second': False,
            'visit_count_idempotent': False,
        }
        
        # Test data storage
        self.test_user_id = None
        self.test_user_email = None
        self.session_token = None
        self.initial_count = 0
        self.count_after_first_login = 0
        self.count_after_second_login = 0
        
    async def setup(self):
        """Setup database connection"""
        try:
            self.client = AsyncIOMotorClient(MONGO_URL)
            self.db = self.client[DB_NAME]
            # Test connection
            await self.db.command('ping')
            logger.info("✅ Database connection established")
            self.test_results['database_connection'] = True
            return True
        except Exception as e:
            logger.error(f"❌ Database connection failed: {e}")
            return False

    async def cleanup(self):
        """Cleanup database connection"""
        if self.client:
            self.client.close()

    async def make_request(self, method, endpoint, headers=None, json_data=None, params=None, cookies=None):
        """Helper method to make HTTP requests"""
        url = f"{self.backend_url}{endpoint}"
        
        # Prepare headers
        if headers is None:
            headers = {}
        
        async with aiohttp.ClientSession() as session:
            try:
                async with session.request(
                    method=method,
                    url=url,
                    headers=headers,
                    json=json_data,
                    params=params,
                    cookies=cookies
                ) as response:
                    status = response.status
                    try:
                        data = await response.json()
                    except:
                        data = await response.text()
                    
                    logger.info(f"{method} {endpoint} - Status: {status}")
                    if status >= 400:
                        logger.warning(f"Response: {data}")
                    
                    return status, data
            except Exception as e:
                logger.error(f"Request failed: {method} {endpoint} - {e}")
                return None, str(e)

    async def test_1_setup_test_user(self):
        """Setup Test User for Visit Count Testing"""
        logger.info("\n👤 STEP 1: Setup Test User")
        try:
            # Create a test user for visit count testing
            self.test_user_id = f"visit-count-test-{uuid.uuid4().hex[:12]}"
            self.test_user_email = f"visit.count.test.{uuid.uuid4().hex[:8]}@example.com"
            
            test_user = {
                "id": self.test_user_id,
                "email": self.test_user_email,
                "name": "Visit Count Test User",
                "is_admin": False,
                "is_mentor": False,
                "plan": "free_trial",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            await self.db.users.insert_one(test_user)
            logger.info(f"✅ Created test user: {self.test_user_email}")
            
            # Create user session for authentication
            self.session_token = f"session_{uuid.uuid4().hex}"
            session_expires = datetime.now(timezone.utc) + timedelta(days=1)
            
            user_session = {
                "user_id": self.test_user_id,
                "session_token": self.session_token,
                "expires_at": session_expires.isoformat(),
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            await self.db.user_sessions.insert_one(user_session)
            logger.info(f"✅ Created user session: {self.session_token[:20]}...")
            
            self.test_results['test_user_setup'] = True
            return True
            
        except Exception as e:
            logger.error(f"❌ Test user setup failed: {e}")
            return False

    async def test_2_unauthenticated_request(self):
        """Test GET /api/tracking/visit-count without authentication"""
        logger.info("\n🔓 STEP 2: Test Unauthenticated Request")
        try:
            # Make request without session token
            status, data = await self.make_request("GET", "/tracking/visit-count")
            
            if status == 200 and isinstance(data, dict):
                count = data.get("count")
                if count == 0:
                    logger.info(f"✅ Unauthenticated request returned count: {count}")
                    self.test_results['unauthenticated_request'] = True
                    return True
                else:
                    logger.error(f"❌ Expected count 0 for unauthenticated request, got: {count}")
                    return False
            else:
                logger.error(f"❌ Unexpected response - Status: {status}, Data: {data}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Unauthenticated request test failed: {e}")
            return False

    async def test_3_authenticated_request_initial(self):
        """Test GET /api/tracking/visit-count with authentication (initial count)"""
        logger.info("\n🔐 STEP 3: Test Authenticated Request (Initial)")
        try:
            # Make request with session token
            cookies = {"session_token": self.session_token}
            status, data = await self.make_request("GET", "/tracking/visit-count", cookies=cookies)
            
            if status == 200 and isinstance(data, dict):
                count = data.get("count")
                if isinstance(count, int) and count >= 0:
                    self.initial_count = count
                    logger.info(f"✅ Authenticated request returned initial count: {count}")
                    self.test_results['authenticated_request_initial'] = True
                    return True
                else:
                    logger.error(f"❌ Invalid count format: {count}")
                    return False
            else:
                logger.error(f"❌ Unexpected response - Status: {status}, Data: {data}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Authenticated request test failed: {e}")
            return False

    async def test_4_track_login_first(self):
        """Test POST /api/tracking/login to create a daily_login event"""
        logger.info("\n📝 STEP 4: Track Login (First Time)")
        try:
            # Make login tracking request
            cookies = {"session_token": self.session_token}
            status, data = await self.make_request("POST", "/tracking/login", cookies=cookies)
            
            if status == 200 and isinstance(data, dict) and data.get("ok"):
                logger.info("✅ Login tracking successful")
                
                # Verify the daily_login event was created in database
                today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
                login_event = await self.db.user_activity.find_one({
                    "user_id": self.test_user_id,
                    "event": "daily_login",
                    "date": today
                })
                
                if login_event:
                    logger.info(f"✅ daily_login event created in database for date: {today}")
                    self.test_results['track_login_first'] = True
                    return True
                else:
                    logger.error("❌ daily_login event not found in database")
                    return False
            else:
                logger.error(f"❌ Login tracking failed - Status: {status}, Data: {data}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Login tracking test failed: {e}")
            return False

    async def test_5_visit_count_after_login(self):
        """Test GET /api/tracking/visit-count after login tracking"""
        logger.info("\n📊 STEP 5: Check Visit Count After Login")
        try:
            # Make request with session token
            cookies = {"session_token": self.session_token}
            status, data = await self.make_request("GET", "/tracking/visit-count", cookies=cookies)
            
            if status == 200 and isinstance(data, dict):
                count = data.get("count")
                if isinstance(count, int) and count >= self.initial_count + 1:
                    self.count_after_first_login = count
                    logger.info(f"✅ Visit count increased after login: {self.initial_count} → {count}")
                    self.test_results['visit_count_after_login'] = True
                    return True
                else:
                    logger.error(f"❌ Visit count did not increase properly. Initial: {self.initial_count}, Current: {count}")
                    return False
            else:
                logger.error(f"❌ Unexpected response - Status: {status}, Data: {data}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Visit count after login test failed: {e}")
            return False

    async def test_6_track_login_second(self):
        """Test POST /api/tracking/login again (same day - should be idempotent)"""
        logger.info("\n📝 STEP 6: Track Login (Second Time - Same Day)")
        try:
            # Make login tracking request again
            cookies = {"session_token": self.session_token}
            status, data = await self.make_request("POST", "/tracking/login", cookies=cookies)
            
            if status == 200 and isinstance(data, dict) and data.get("ok"):
                logger.info("✅ Second login tracking successful")
                
                # Verify only one daily_login event exists for today
                today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
                login_events = await self.db.user_activity.count_documents({
                    "user_id": self.test_user_id,
                    "event": "daily_login",
                    "date": today
                })
                
                if login_events == 1:
                    logger.info(f"✅ Only one daily_login event exists for today (idempotent)")
                    self.test_results['track_login_second'] = True
                    return True
                else:
                    logger.error(f"❌ Expected 1 daily_login event, found: {login_events}")
                    return False
            else:
                logger.error(f"❌ Second login tracking failed - Status: {status}, Data: {data}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Second login tracking test failed: {e}")
            return False

    async def test_7_visit_count_idempotent(self):
        """Test GET /api/tracking/visit-count after second login (should not increase)"""
        logger.info("\n📊 STEP 7: Check Visit Count After Second Login (Idempotent)")
        try:
            # Make request with session token
            cookies = {"session_token": self.session_token}
            status, data = await self.make_request("GET", "/tracking/visit-count", cookies=cookies)
            
            if status == 200 and isinstance(data, dict):
                count = data.get("count")
                if count == self.count_after_first_login:
                    self.count_after_second_login = count
                    logger.info(f"✅ Visit count remained same after second login: {count} (idempotent)")
                    self.test_results['visit_count_idempotent'] = True
                    return True
                else:
                    logger.error(f"❌ Visit count changed after second login. Expected: {self.count_after_first_login}, Got: {count}")
                    return False
            else:
                logger.error(f"❌ Unexpected response - Status: {status}, Data: {data}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Visit count idempotent test failed: {e}")
            return False

    async def run_all_tests(self):
        """Run all tests and provide summary"""
        logger.info("🚀 Starting Visit Count API Tests\n")
        
        # Setup
        if not await self.setup():
            logger.error("❌ Failed to setup database connection")
            return False
        
        # Run all tests in sequence
        tests = [
            ('Setup Test User', self.test_1_setup_test_user),
            ('Unauthenticated Request', self.test_2_unauthenticated_request),
            ('Authenticated Request (Initial)', self.test_3_authenticated_request_initial),
            ('Track Login (First)', self.test_4_track_login_first),
            ('Visit Count After Login', self.test_5_visit_count_after_login),
            ('Track Login (Second - Same Day)', self.test_6_track_login_second),
            ('Visit Count Idempotent Check', self.test_7_visit_count_idempotent),
        ]
        
        passed = 0
        total = len(tests)
        
        for test_name, test_func in tests:
            try:
                logger.info(f"\n⏳ Running: {test_name}")
                result = await test_func()
                if result:
                    passed += 1
                    logger.info(f"✅ {test_name}: PASSED")
                else:
                    logger.error(f"❌ {test_name}: FAILED")
            except Exception as e:
                logger.error(f"❌ Test '{test_name}' crashed: {e}")
        
        # Cleanup
        await self.cleanup()
        
        # Summary
        logger.info(f"\n📊 VISIT COUNT API TEST SUMMARY")
        logger.info(f"=" * 60)
        logger.info(f"Total Tests: {total}")
        logger.info(f"Passed: {passed}")
        logger.info(f"Failed: {total - passed}")
        logger.info(f"Success Rate: {passed/total*100:.1f}%")
        
        logger.info(f"\n📋 DETAILED RESULTS:")
        for key, result in self.test_results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            test_name = key.replace('_', ' ').title()
            logger.info(f"   {test_name}: {status}")
        
        logger.info(f"\n📈 VISIT COUNT PROGRESSION:")
        logger.info(f"   Initial Count: {self.initial_count}")
        logger.info(f"   After First Login: {self.count_after_first_login}")
        logger.info(f"   After Second Login: {self.count_after_second_login}")
        
        return passed == total

async def main():
    """Main test execution function"""
    test_suite = VisitCountTest()
    success = await test_suite.run_all_tests()
    
    if success:
        logger.info("\n🎉 ALL TESTS PASSED! Visit Count API is working correctly.")
        sys.exit(0)
    else:
        logger.error("\n❌ SOME TESTS FAILED! Check the logs above for details.")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())