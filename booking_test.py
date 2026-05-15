#!/usr/bin/env python3
"""
Partner API Booking Test - Quick test for booking functionality
"""

import asyncio
import sys
import os
import json
import logging
from datetime import datetime, timedelta
import aiohttp
from motor.motor_asyncio import AsyncIOMotorClient

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

async def test_booking():
    # Use the API key from the last successful test
    api_key = "pk_live_vRhjbSwtR9bGMFe4VLHeHhOktsvp14OFCTJjCYFp9nM"  # From the logs
    mentor_id = "mentor-abhishek"
    
    # Test availability first
    async with aiohttp.ClientSession() as session:
        # Get availability
        headers = {"X-Partner-API-Key": api_key}
        params = {
            "start_date": (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d"),
            "end_date": (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        }
        
        url = f"{BACKEND_URL}/partner/mentors/{mentor_id}/availability"
        async with session.get(url, headers=headers, params=params) as response:
            status = response.status
            data = await response.json()
            
            logger.info(f"Availability check - Status: {status}")
            availability = data.get("availability", [])
            logger.info(f"Found availability for {len(availability)} days")
            
            # Find first available slot
            available_slot = None
            available_date = None
            
            for day in availability:
                slots = day.get("slots", [])
                if slots:
                    available_date = day.get("date")
                    available_slot = slots[0]
                    logger.info(f"✅ Available slot found: {available_date} at {available_slot}")
                    break
            
            if available_slot:
                # Try to create booking
                booking_data = {
                    "mentor_id": mentor_id,
                    "date": available_date,
                    "time_slot": available_slot,
                    "candidate_name": "John Doe",
                    "candidate_email": "john.doe@testinstitute.edu",
                    "session_type": "case_interview",
                    "duration_minutes": 45,
                    "notes": "Test booking with actual availability"
                }
                
                url = f"{BACKEND_URL}/partner/bookings"
                async with session.post(url, headers=headers, json=booking_data) as response:
                    status = response.status
                    data = await response.json()
                    
                    logger.info(f"Booking creation - Status: {status}")
                    logger.info(f"Response: {data}")
                    
                    if status == 200 and data.get("success"):
                        booking_id = data["booking"]["id"]
                        logger.info(f"✅ Booking successful: {booking_id}")
                        
                        # Test cancellation
                        url = f"{BACKEND_URL}/partner/bookings/{booking_id}"
                        async with session.delete(url, headers=headers, json={"reason": "Test cancellation"}) as response:
                            status = response.status
                            data = await response.json()
                            logger.info(f"Cancellation - Status: {status}")
                            logger.info(f"Cancellation response: {data}")
                    else:
                        logger.error(f"❌ Booking failed")
            else:
                logger.warning("⚠️ No available slots found")

if __name__ == "__main__":
    asyncio.run(test_booking())