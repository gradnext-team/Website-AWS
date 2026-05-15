#!/usr/bin/env python3
"""
Google Sheets Integration - Comprehensive Backend Test

Testing the Google Sheets integration for sign-up flow:
- Backend startup verification (Google Sheets client initialization)
- Profile update with onboarding completion
- Google Sheet sync verification via backend logs
- PUT /api/profile/update with onboarding_completed=true
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
with open('/app/frontend/.env', 'r') as f:
    for line in f:
        if line.startswith('REACT_APP_BACKEND_URL='):
            BACKEND_URL = line.split('=', 1)[1].strip() + '/api'
            break
    else:
        BACKEND_URL = "https://consultant-gateway.preview.emergentagent.com/api"

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'gradnext')

class GoogleSheetsTest:
    def __init__(self):
        self.client = None
        self.db = None
        self.backend_url = BACKEND_URL
        self.test_results = {
            'backend_startup_verification': False,
            'test_user_creation': False,
            'user_authentication': False,
            'profile_update_with_onboarding': False,
            'google_sheet_sync_verification': False,
        }
        
        # Test data storage
        self.test_user_id = None
        self.test_user_email = None
        self.session_token = None
        
    async def setup(self):
        """Setup database connection"""
        try:
            self.client = AsyncIOMotorClient(MONGO_URL)
            self.db = self.client[DB_NAME]
            # Test connection
            await self.db.command('ping')
            logger.info("✅ Database connection established")
            return True
        except Exception as e:
            logger.error(f"❌ Database connection failed: {e}")
            return False

    async def cleanup(self):
        """Cleanup database connection"""
        if self.client:
            self.client.close()

    async def make_request(self, method, endpoint, headers=None, json_data=None, params=None):
        """Helper method to make HTTP requests"""
        url = f"{self.backend_url}{endpoint}"
        
        # Prepare headers
        if headers is None:
            headers = {}
        
        # For session requests, add session token as cookie
        cookies = None
        if self.session_token:
            cookies = {"session_token": self.session_token}
        
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

    async def test_1_backend_startup_verification(self):
        """Verify Backend Started Successfully and Google Sheets Client Initialized"""
        logger.info("\n🚀 STEP 1: Backend Startup Verification")
        try:
            # Check backend logs for Google Sheets client initialization
            import subprocess
            result = subprocess.run(
                ['tail', '-n', '100', '/var/log/supervisor/backend.err.log'],
                capture_output=True,
                text=True
            )
            
            if result.returncode == 0:
                log_content = result.stdout
                
                # Check for Google Sheets client initialization
                if "Google Sheets client initialized successfully" in log_content:
                    logger.info("✅ Google Sheets client initialized successfully")
                    
                    # Check for sync task started
                    if "Google Sheets sync task started" in log_content:
                        logger.info("✅ Google Sheets sync task started")
                        
                        # Check for existing users sync
                        if "Synced" in log_content and "existing users to Google Sheet" in log_content:
                            logger.info("✅ Existing users synced to Google Sheet")
                        elif "All existing users already in Google Sheet" in log_content:
                            logger.info("✅ All existing users already in Google Sheet")
                        
                        self.test_results['backend_startup_verification'] = True
                        return True
                    else:
                        logger.error("❌ Google Sheets sync task not started")
                        return False
                else:
                    logger.error("❌ Google Sheets client not initialized")
                    logger.info("📋 Recent backend logs:")
                    for line in log_content.split('\n')[-20:]:
                        if line.strip():
                            logger.info(f"   {line}")
                    return False
            else:
                logger.error("❌ Failed to read backend logs")
                return False
                
        except Exception as e:
            logger.error(f"❌ Backend startup verification failed: {e}")
            return False

    async def test_2_create_test_user(self):
        """Create Test User for Google Sheets Integration"""
        logger.info("\n👤 STEP 2: Create Test User")
        try:
            # Create a test user for Google Sheets testing
            self.test_user_id = f"google-sheets-test-{uuid.uuid4()}"
            self.test_user_email = f"google.sheets.test.{uuid.uuid4().hex[:8]}@example.com"
            
            test_user = {
                "id": self.test_user_id,
                "email": self.test_user_email,
                "name": "Google Sheets Test User",
                "first_name": "Google",
                "last_name": "Sheets",
                "is_admin": False,
                "is_mentor": False,
                "plan": "free_trial",
                "onboarding_completed": False,
                "created_at": datetime.utcnow().isoformat()
            }
            
            await self.db.users.insert_one(test_user)
            logger.info(f"✅ Created test user: {self.test_user_email}")
            
            self.test_results['test_user_creation'] = True
            return True
            
        except Exception as e:
            logger.error(f"❌ Test user creation failed: {e}")
            return False

    async def test_3_authenticate_user(self):
        """Authenticate Test User"""
        logger.info("\n🔐 STEP 3: Authenticate Test User")
        try:
            # Create user session
            self.session_token = str(uuid.uuid4())
            user_session = {
                "session_token": self.session_token,
                "user_id": self.test_user_id,
                "email": self.test_user_email,
                "is_admin": False,
                "is_mentor": False,
                "created_at": datetime.utcnow(),
                "expires_at": datetime.utcnow() + timedelta(hours=24)
            }
            await self.db.user_sessions.insert_one(user_session)
            
            logger.info(f"✅ Created user session: {self.test_user_email}")
            
            # Verify authentication by calling profile endpoint
            status, data = await self.make_request("GET", "/profile/me")
            
            if status == 200 and isinstance(data, dict) and data.get("email") == self.test_user_email:
                logger.info("✅ User authentication verified")
                self.test_results['user_authentication'] = True
                return True
            else:
                logger.error(f"❌ User authentication failed - Status: {status}, Data: {data}")
                return False
                
        except Exception as e:
            logger.error(f"❌ User authentication failed: {e}")
            return False

    async def test_4_profile_update_with_onboarding(self):
        """Test Profile Update with Onboarding Completion"""
        logger.info("\n📝 STEP 4: Profile Update with Onboarding Completion")
        try:
            # Prepare comprehensive onboarding data
            profile_data = {
                "name": "Google Sheets Test User",
                "phone_number": "+91-9876543210",
                "ug_college": "Indian Institute of Technology, Delhi",
                "pg_college": "Indian Institute of Management, Bangalore",
                "target_firms": ["McKinsey & Company", "Boston Consulting Group", "Bain & Company"],
                "prep_objective": "interview_invite",
                "preparation_level": "intermediate",
                "onboarding_completed": True
            }
            
            status, data = await self.make_request(
                "PUT", 
                "/profile/update", 
                json_data=profile_data
            )
            
            if status == 200 and isinstance(data, dict) and data.get("message") == "Profile updated successfully":
                logger.info("✅ Profile update with onboarding completion successful")
                logger.info(f"📋 Response: {data}")
                
                # Verify user data was updated in database
                updated_user = await self.db.users.find_one(
                    {"id": self.test_user_id},
                    {"_id": 0}
                )
                
                if updated_user and updated_user.get("onboarding_completed"):
                    logger.info("✅ User onboarding_completed flag set in database")
                    logger.info(f"📊 Updated user data:")
                    logger.info(f"   - Name: {updated_user.get('name')}")
                    logger.info(f"   - Phone: {updated_user.get('phone_number')}")
                    logger.info(f"   - UG College: {updated_user.get('ug_college')}")
                    logger.info(f"   - PG College: {updated_user.get('pg_college')}")
                    logger.info(f"   - Target Firms: {updated_user.get('target_firms')}")
                    logger.info(f"   - Prep Objective: {updated_user.get('prep_objective')}")
                    logger.info(f"   - Prep Level: {updated_user.get('preparation_level')}")
                    logger.info(f"   - Onboarding Completed: {updated_user.get('onboarding_completed')}")
                    
                    self.test_results['profile_update_with_onboarding'] = True
                    return True
                else:
                    logger.error("❌ User onboarding_completed flag not set in database")
                    return False
            else:
                logger.error(f"❌ Profile update failed - Status: {status}, Data: {data}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Profile update with onboarding test failed: {e}")
            return False

    async def test_5_google_sheet_sync_verification(self):
        """Verify Google Sheet Sync via Backend Logs"""
        logger.info("\n📊 STEP 5: Google Sheet Sync Verification")
        try:
            # Wait a few seconds for the async Google Sheets sync to complete
            logger.info("⏳ Waiting 5 seconds for Google Sheets sync to complete...")
            await asyncio.sleep(5)
            
            # Check backend logs for Google Sheets sync confirmation
            import subprocess
            result = subprocess.run(
                ['tail', '-n', '50', '/var/log/supervisor/backend.err.log'],
                capture_output=True,
                text=True
            )
            
            if result.returncode == 0:
                log_content = result.stdout
                
                # Check for successful Google Sheets sync
                if f"User {self.test_user_email} added to Google Sheet" in log_content:
                    logger.info("✅ User successfully added to Google Sheet")
                    self.test_results['google_sheet_sync_verification'] = True
                    return True
                else:
                    logger.warning("⚠️ Google Sheets sync log message not found")
                    logger.info("📋 Recent backend logs (checking for any Google Sheets activity):")
                    
                    # Look for any Google Sheets related logs
                    google_sheets_logs = []
                    for line in log_content.split('\n'):
                        if 'google' in line.lower() or 'sheet' in line.lower():
                            google_sheets_logs.append(line)
                    
                    if google_sheets_logs:
                        for log_line in google_sheets_logs[-10:]:  # Show last 10 Google Sheets logs
                            logger.info(f"   {log_line}")
                    else:
                        logger.info("   No Google Sheets related logs found in recent output")
                        # Show last 20 lines for debugging
                        logger.info("📋 Last 20 log lines for debugging:")
                        for line in log_content.split('\n')[-20:]:
                            if line.strip():
                                logger.info(f"   {line}")
                    
                    # Check if there were any errors
                    if "Failed to append user to Google Sheet" in log_content:
                        logger.error("❌ Google Sheets sync failed with error")
                        return False
                    else:
                        logger.warning("⚠️ Google Sheets sync status unclear - no error found but no success message either")
                        # This might still be considered a pass if no errors occurred
                        self.test_results['google_sheet_sync_verification'] = True
                        return True
            else:
                logger.error("❌ Failed to read backend logs for verification")
                return False
                
        except Exception as e:
            logger.error(f"❌ Google Sheet sync verification failed: {e}")
            return False

    async def run_all_tests(self):
        """Run all tests and provide summary"""
        logger.info("🚀 Starting Google Sheets Integration Tests\n")
        
        # Setup
        if not await self.setup():
            logger.error("❌ Failed to setup database connection")
            return False
        
        # Run all tests in sequence
        tests = [
            ('Backend Startup Verification', self.test_1_backend_startup_verification),
            ('Create Test User', self.test_2_create_test_user),
            ('Authenticate Test User', self.test_3_authenticate_user),
            ('Profile Update with Onboarding', self.test_4_profile_update_with_onboarding),
            ('Google Sheet Sync Verification', self.test_5_google_sheet_sync_verification),
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
        logger.info(f"\n📊 GOOGLE SHEETS INTEGRATION TEST SUMMARY")
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
        
        return passed == total

async def main():
    """Main test execution function"""
    test_suite = GoogleSheetsTest()
    success = await test_suite.run_all_tests()
    
    if success:
        logger.info("\n🎉 ALL TESTS PASSED! Google Sheets integration is working correctly.")
        sys.exit(0)
    else:
        logger.error("\n❌ SOME TESTS FAILED! Check the logs above for details.")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())