"""
Test script to send WATI attribute update to Kashish
"""
import asyncio
import sys
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/backend/.env')

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from services.wati_service import wati_service

async def test_wati_update():
    """Test WATI attribute update for Kashish"""
    
    # Phone numbers to test (from handoff notes)
    phone_numbers = [
        "918222866630",  # Primary
        "919996995022"   # Alternative
    ]
    
    attribute_name = "workshop_name"
    attribute_value = "Test Workshop - Agent Handover Verification"
    
    print("=" * 60)
    print("🧪 WATI Attribute Update Test for Kashish")
    print("=" * 60)
    print(f"Attribute: {attribute_name}")
    print(f"Value: {attribute_value}")
    print()
    
    for phone in phone_numbers:
        print(f"\n📱 Testing phone: {phone}")
        print("-" * 60)
        
        try:
            result = await wati_service.update_contact_attribute(
                recipient_number=phone,
                attribute_name=attribute_name,
                attribute_value=attribute_value
            )
            
            print("✅ SUCCESS!")
            print(f"Status Code: {result.get('status')}")
            print(f"Response: {result.get('response')}")
            print(f"Phone: {result.get('phone')}")
            print(f"Attribute Updated: {result.get('attribute')} = {result.get('value')}")
            
            # If first number succeeds, no need to try second
            print("\n🎉 Test completed successfully!")
            print("The WATI automation flow should trigger based on this attribute update.")
            break
            
        except Exception as e:
            print(f"❌ ERROR: {str(e)}")
            print(f"Trying next phone number...\n")
            continue
    else:
        print("\n⚠️  All phone numbers failed. Check WATI configuration.")
        return False
    
    return True

if __name__ == "__main__":
    success = asyncio.run(test_wati_update())
    sys.exit(0 if success else 1)
