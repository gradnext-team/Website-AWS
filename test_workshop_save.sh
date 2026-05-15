#!/bin/bash

# Test Workshop Save Functionality
echo "====== Testing Workshop Save Endpoint ======"
echo ""

# Step 1: Login as admin
echo "Step 1: Logging in as admin..."
LOGIN_RESPONSE=$(curl -s -c /tmp/cookies.txt -X POST "https://consultant-gateway.preview.emergentagent.com/api/auth/mock-login" \
  -H "Content-Type: application/json" \
  -d '{"role": "admin"}')

echo "Login Response: $LOGIN_RESPONSE"
echo ""

# Step 2: Try to create a workshop
echo "Step 2: Creating workshop with multiple thumbnails..."
CREATE_RESPONSE=$(curl -s -b /tmp/cookies.txt -X POST "https://consultant-gateway.preview.emergentagent.com/api/admin/workshops" \
  -H "Content-Type: application/json" \
  -w "\nHTTP_STATUS:%{http_code}" \
  -d '{
    "title": "Test Workshop with Multiple Thumbnails",
    "description": "Testing thumbnail aspect ratios",
    "instructor": "Test Instructor",
    "instructor_title": "Ex-Test Company",
    "date": "2026-06-15",
    "time": "14:00",
    "duration": "2 hours",
    "thumbnail": "https://example.com/legacy.jpg",
    "thumbnail_hero": "https://example.com/hero-21-9.jpg",
    "thumbnail_card": "https://example.com/card-16-9.jpg",
    "thumbnail_recording": "https://example.com/recording-16-9.jpg",
    "status": "upcoming",
    "is_free": true,
    "max_participants": 50,
    "topics": ["Test Topic 1", "Test Topic 2"]
  }')

echo "Create Response: $CREATE_RESPONSE"
echo ""

# Step 3: Get all workshops to verify
echo "Step 3: Fetching all workshops..."
GET_RESPONSE=$(curl -s -b /tmp/cookies.txt "https://consultant-gateway.preview.emergentagent.com/api/admin/workshops")
echo "Workshops: $GET_RESPONSE" | jq '.workshops | length'
echo ""

# Clean up
rm -f /tmp/cookies.txt

echo "====== Test Complete ======"
