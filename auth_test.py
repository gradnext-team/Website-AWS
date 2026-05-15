#!/usr/bin/env python3
"""
Test authentication requirement specifically
"""

import asyncio
import aiohttp
import json

BASE_URL = "https://consultant-gateway.preview.emergentagent.com/api"

async def test_auth_requirement():
    """Test authentication requirement"""
    
    session = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=30))
    
    try:
        print("🔒 Testing Authentication Requirement")
        
        # Test without any authentication
        print("\n1. Testing without any cookies or headers...")
        otp_payload = {"phone_number": "9876543210", "country_code": "+91"}
        async with session.post(f"{BASE_URL}/profile/phone/send-otp", json=otp_payload) as response:
            response_text = await response.text()
            print(f"Status: {response.status}")
            print(f"Response: {response_text[:200]}")
            
        # Test with invalid session token
        print("\n2. Testing with invalid session token...")
        invalid_cookies = {'session_token': 'invalid_token_12345'}
        async with session.post(f"{BASE_URL}/profile/phone/send-otp", json=otp_payload, cookies=invalid_cookies) as response:
            response_text = await response.text()
            print(f"Status: {response.status}")
            print(f"Response: {response_text[:200]}")
            
        # Test with Authorization header
        print("\n3. Testing with invalid Authorization header...")
        invalid_headers = {'Authorization': 'Bearer invalid_token_12345'}
        async with session.post(f"{BASE_URL}/profile/phone/send-otp", json=otp_payload, headers=invalid_headers) as response:
            response_text = await response.text()
            print(f"Status: {response.status}")
            print(f"Response: {response_text[:200]}")
        
    except Exception as e:
        print(f"❌ Test error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await session.close()

if __name__ == "__main__":
    asyncio.run(test_auth_requirement())