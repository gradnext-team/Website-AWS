#!/usr/bin/env python3
"""
Simple Phone OTP Test - Core functionality only
"""

import asyncio
import aiohttp
import json
import os
from motor.motor_asyncio import AsyncIOMotorClient

BASE_URL = "https://consultant-gateway.preview.emergentagent.com/api"
TEST_USER_EMAIL = "fullprep@gradnext.co"
TEST_PHONE = "9876543210"
TEST_COUNTRY_CODE = "+91"

async def test_phone_otp_flow():
    """Test the complete phone OTP flow"""
    
    # Setup
    session = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=30))
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ.get('DB_NAME', 'gradnext')]
    
    try:
        print("🚀 Testing Phone OTP Flow")
        
        # 1. Login
        print("\n1. 🔐 Logging in...")
        # Use user_type instead of email/role for mock login
        async with session.post(f"{BASE_URL}/auth/mock-login?user_type=full_prep") as response:
            if response.status == 200:
                session_token = response.cookies.get('session_token').value
                print(f"✅ Login successful")
            else:
                print(f"❌ Login failed: {response.status}")
                return
        
        # 2. Send OTP
        print("\n2. 📱 Sending OTP...")
        otp_payload = {"phone_number": TEST_PHONE, "country_code": TEST_COUNTRY_CODE}
        cookies = {'session_token': session_token}
        
        async with session.post(f"{BASE_URL}/profile/phone/send-otp", json=otp_payload, cookies=cookies) as response:
            response_text = await response.text()
            if response.status == 200:
                data = json.loads(response_text)
                if data.get("success"):
                    method = data.get("method", "unknown")
                    print(f"✅ OTP sent via {method}")
                    print(f"   Message: {data.get('message', '')}")
                else:
                    print(f"❌ OTP send failed: {data}")
                    return
            else:
                print(f"❌ OTP send failed: {response.status} - {response_text}")
                return
        
        # 3. Get OTP from database
        print("\n3. 🔍 Getting OTP from database...")
        user = await db.users.find_one({"email": TEST_USER_EMAIL})
        if user:
            otp_record = await db.phone_otp_codes.find_one({"user_id": user.get("id")})
            if otp_record:
                otp = otp_record.get("otp")
                print(f"✅ Found OTP in database: {otp}")
            else:
                print("❌ No OTP found in database")
                return
        else:
            print("❌ User not found")
            return
        
        # 4. Verify OTP
        print("\n4. ✅ Verifying OTP...")
        verify_payload = {
            "phone_number": TEST_PHONE,
            "country_code": TEST_COUNTRY_CODE,
            "otp": otp
        }
        
        async with session.post(f"{BASE_URL}/profile/phone/verify-otp", json=verify_payload, cookies=cookies) as response:
            response_text = await response.text()
            if response.status == 200:
                data = json.loads(response_text)
                if data.get("success"):
                    print(f"✅ OTP verified successfully")
                    print(f"   Phone verified: {data.get('phone_verified')}")
                else:
                    print(f"❌ OTP verification failed: {data}")
                    return
            else:
                print(f"❌ OTP verification failed: {response.status} - {response_text}")
                return
        
        # 5. Check user was updated
        print("\n5. 🔍 Checking user update...")
        user = await db.users.find_one({"email": TEST_USER_EMAIL})
        if user:
            phone_verified = user.get("phone_verified")
            whatsapp_number = user.get("whatsapp_number")
            print(f"✅ User updated: phone_verified={phone_verified}, whatsapp_number={whatsapp_number}")
        else:
            print("❌ User not found after verification")
        
        # 6. Test wrong OTP
        print("\n6. ❌ Testing wrong OTP...")
        wrong_payload = {
            "phone_number": TEST_PHONE,
            "country_code": TEST_COUNTRY_CODE,
            "otp": "000000"
        }
        
        async with session.post(f"{BASE_URL}/profile/phone/verify-otp", json=wrong_payload, cookies=cookies) as response:
            if response.status == 400:
                print("✅ Wrong OTP correctly rejected")
            else:
                response_text = await response.text()
                print(f"❌ Wrong OTP not rejected: {response.status} - {response_text}")
        
        # 7. Remove phone
        print("\n7. 🗑️ Removing phone...")
        async with session.delete(f"{BASE_URL}/profile/phone/remove", cookies=cookies) as response:
            response_text = await response.text()
            if response.status == 200:
                data = json.loads(response_text)
                if data.get("success"):
                    print("✅ Phone removed successfully")
                else:
                    print(f"❌ Phone removal failed: {data}")
            else:
                print(f"❌ Phone removal failed: {response.status} - {response_text}")
        
        # 8. Check user was updated
        print("\n8. 🔍 Checking phone removal...")
        user = await db.users.find_one({"email": TEST_USER_EMAIL})
        if user:
            phone_verified = user.get("phone_verified")
            whatsapp_number = user.get("whatsapp_number")
            print(f"✅ User updated: phone_verified={phone_verified}, whatsapp_number={whatsapp_number}")
        
        print("\n🎉 Phone OTP flow test completed!")
        
    except Exception as e:
        print(f"❌ Test error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await session.close()
        client.close()

if __name__ == "__main__":
    asyncio.run(test_phone_otp_flow())