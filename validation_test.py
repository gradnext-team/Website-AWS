#!/usr/bin/env python3
"""
Additional Phone OTP Tests - Validation and Edge Cases
"""

import asyncio
import aiohttp
import json

BASE_URL = "https://consultant-gateway.preview.emergentagent.com/api"

async def test_validation_and_edge_cases():
    """Test validation and edge cases"""
    
    session = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=30))
    
    try:
        print("🧪 Testing Validation and Edge Cases")
        
        # 1. Login
        print("\n1. 🔐 Logging in...")
        async with session.post(f"{BASE_URL}/auth/mock-login?user_type=full_prep") as response:
            if response.status == 200:
                session_token = response.cookies.get('session_token').value
                print(f"✅ Login successful")
            else:
                print(f"❌ Login failed: {response.status}")
                return
        
        cookies = {'session_token': session_token}
        
        # 2. Test authentication required
        print("\n2. 🔒 Testing authentication required...")
        otp_payload = {"phone_number": "9876543210", "country_code": "+91"}
        async with session.post(f"{BASE_URL}/profile/phone/send-otp", json=otp_payload) as response:
            if response.status in [401, 403]:
                print("✅ Correctly requires authentication")
            else:
                print(f"❌ Should require authentication, got {response.status}")
        
        # 3. Test empty phone validation
        print("\n3. 📱 Testing empty phone validation...")
        empty_payload = {"phone_number": "", "country_code": "+91"}
        async with session.post(f"{BASE_URL}/profile/phone/send-otp", json=empty_payload, cookies=cookies) as response:
            if response.status == 400:
                print("✅ Correctly rejected empty phone")
            else:
                response_text = await response.text()
                print(f"❌ Should reject empty phone, got {response.status}: {response_text}")
        
        # 4. Test invalid phone validation
        print("\n4. 📱 Testing invalid phone validation...")
        invalid_payload = {"phone_number": "123", "country_code": "+91"}
        async with session.post(f"{BASE_URL}/profile/phone/send-otp", json=invalid_payload, cookies=cookies) as response:
            if response.status == 400:
                print("✅ Correctly rejected invalid phone")
            else:
                response_text = await response.text()
                print(f"❌ Should reject invalid phone, got {response.status}: {response_text}")
        
        # 5. Test rate limiting
        print("\n5. ⏱️ Testing rate limiting...")
        valid_payload = {"phone_number": "9876543210", "country_code": "+91"}
        
        # Send first OTP
        async with session.post(f"{BASE_URL}/profile/phone/send-otp", json=valid_payload, cookies=cookies) as response:
            first_status = response.status
            if first_status == 200:
                print("✅ First OTP request successful")
            else:
                response_text = await response.text()
                print(f"❌ First OTP failed: {first_status}: {response_text}")
        
        # Immediately send second OTP
        async with session.post(f"{BASE_URL}/profile/phone/send-otp", json=valid_payload, cookies=cookies) as response:
            second_status = response.status
            if second_status == 429:
                response_data = json.loads(await response.text())
                print(f"✅ Rate limiting working: {response_data.get('detail', '')}")
            else:
                response_text = await response.text()
                print(f"❌ Rate limiting not working: {second_status}: {response_text}")
        
        # 6. Test wrong OTP verification
        print("\n6. ❌ Testing wrong OTP verification...")
        wrong_otp_payload = {
            "phone_number": "9876543210",
            "country_code": "+91",
            "otp": "000000"
        }
        async with session.post(f"{BASE_URL}/profile/phone/verify-otp", json=wrong_otp_payload, cookies=cookies) as response:
            if response.status == 400:
                response_data = json.loads(await response.text())
                detail = response_data.get("detail", "")
                if "attempts" in detail.lower() or "incorrect" in detail.lower():
                    print(f"✅ Wrong OTP correctly rejected: {detail}")
                else:
                    print(f"✅ Wrong OTP rejected: {detail}")
            else:
                response_text = await response.text()
                print(f"❌ Wrong OTP should be rejected: {response.status}: {response_text}")
        
        print("\n🎉 Validation and edge case tests completed!")
        
    except Exception as e:
        print(f"❌ Test error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await session.close()

if __name__ == "__main__":
    asyncio.run(test_validation_and_edge_cases())