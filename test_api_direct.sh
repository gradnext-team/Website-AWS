#!/bin/bash

echo "Testing Strategy Call APIs directly..."
echo ""

# Login as test user first to get session
echo "Step 1: Create session for test user..."
curl -s -c /tmp/cookies.txt \
  -X POST "http://localhost:8001/api/auth/mock-login?user_type=subscription" \
  > /dev/null

# Get unified availability
echo "Step 2: Fetching unified availability..."
response=$(curl -s -b /tmp/cookies.txt \
  "http://localhost:8001/api/strategy-calls/unified-availability")

echo "$response" | python3 -m json.tool

# Count slots
slot_count=$(echo "$response" | python3 -c "import sys, json; data=json.load(sys.stdin); print(len(data.get('slots', {})))" 2>/dev/null)

echo ""
echo "Slot dates found: $slot_count"

# Cleanup
rm -f /tmp/cookies.txt
