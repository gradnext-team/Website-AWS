"""
Backend API Testing for Sales Transactions Bug Fix
Tests the deduplication logic fix for sales transactions endpoint
"""

import requests
import json
from datetime import datetime, timezone
from pymongo import MongoClient
import os

# Configuration
BASE_URL = "https://consultant-gateway.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@gradnext.co"

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'gradnext')

# Test results tracking
test_results = {
    "passed": 0,
    "failed": 0,
    "tests": []
}

def log_test(test_name, passed, details=""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {test_name}")
    if details:
        print(f"   Details: {details}")
    
    test_results["tests"].append({
        "name": test_name,
        "passed": passed,
        "details": details
    })
    
    if passed:
        test_results["passed"] += 1
    else:
        test_results["failed"] += 1

def print_summary():
    """Print test summary"""
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    print(f"Total Tests: {test_results['passed'] + test_results['failed']}")
    print(f"Passed: {test_results['passed']}")
    print(f"Failed: {test_results['failed']}")
    print("="*80)
    
    if test_results["failed"] > 0:
        print("\nFailed Tests:")
        for test in test_results["tests"]:
            if not test["passed"]:
                print(f"  ❌ {test['name']}")
                if test["details"]:
                    print(f"     {test['details']}")

# ============================================================================
# Test 1: Admin Login
# ============================================================================
print("\n" + "="*80)
print("TEST 1: Admin Login")
print("="*80)

try:
    response = requests.post(
        f"{BASE_URL}/auth/mock-login",
        params={"user_type": "admin"},
        timeout=10
    )
    
    if response.status_code == 200:
        auth_token = response.cookies.get("auth_token")
        response_data = response.json()
        bearer_token = response_data.get("token")
        
        if auth_token:
            log_test("Admin login successful", True, f"Got auth_token cookie")
            
            session = requests.Session()
            session.cookies.set("auth_token", auth_token)
            
            if bearer_token:
                session.headers.update({"Authorization": f"Bearer {bearer_token}"})
                log_test("Bearer token received", True, f"Token: {bearer_token[:20]}...")
        else:
            log_test("Admin login - auth_token cookie", False, "No auth_token cookie in response")
            session = None
    else:
        log_test("Admin login", False, f"Status {response.status_code}: {response.text[:200]}")
        session = None
except Exception as e:
    log_test("Admin login", False, f"Exception: {str(e)}")
    session = None

if not session:
    print("\n❌ Cannot proceed without admin authentication")
    print_summary()
    exit(1)

# ============================================================================
# Test 2: GET /api/admin/sales/transactions/_diagnose (NEW endpoint)
# ============================================================================
print("\n" + "="*80)
print("TEST 2: GET /api/admin/sales/transactions/_diagnose")
print("="*80)

try:
    response = session.get(
        f"{BASE_URL}/admin/sales/transactions/_diagnose",
        timeout=10
    )
    
    if response.status_code == 200:
        data = response.json()
        
        # Verify response shape
        required_keys = ["payment_orders", "payments", "expected_transactions_min", "note"]
        has_all_keys = all(key in data for key in required_keys)
        
        if has_all_keys:
            log_test("Diagnose endpoint returns correct structure", True, 
                    f"Has all required keys: {required_keys}")
            
            # Verify payment_orders structure
            po = data.get("payment_orders", {})
            po_keys = ["total", "by_status", "matching_paid_or_completed", "sample_paid"]
            has_po_keys = all(key in po for key in po_keys)
            log_test("payment_orders has correct structure", has_po_keys,
                    f"Keys: {list(po.keys())}")
            
            # Verify payments structure
            p = data.get("payments", {})
            p_keys = ["total", "by_status", "matching_captured", "sample_captured"]
            has_p_keys = all(key in p for key in p_keys)
            log_test("payments has correct structure", has_p_keys,
                    f"Keys: {list(p.keys())}")
            
            print(f"   Payment Orders Total: {po.get('total', 0)}")
            print(f"   Payments Total: {p.get('total', 0)}")
            print(f"   Expected Transactions Min: {data.get('expected_transactions_min', 0)}")
        else:
            log_test("Diagnose endpoint structure", False, 
                    f"Missing keys. Got: {list(data.keys())}")
    else:
        log_test("Diagnose endpoint", False, 
                f"Status {response.status_code}: {response.text[:200]}")
except Exception as e:
    log_test("Diagnose endpoint", False, f"Exception: {str(e)}")

# ============================================================================
# Test 3: Verify diagnose endpoint requires admin auth
# ============================================================================
print("\n" + "="*80)
print("TEST 3: Diagnose endpoint requires admin auth")
print("="*80)

try:
    # Try without auth
    response = requests.get(
        f"{BASE_URL}/admin/sales/transactions/_diagnose",
        timeout=10
    )
    
    if response.status_code in [401, 403]:
        log_test("Diagnose endpoint rejects unauthorized requests", True,
                f"Status {response.status_code} (expected 401 or 403)")
    else:
        log_test("Diagnose endpoint auth check", False,
                f"Expected 401/403, got {response.status_code}")
except Exception as e:
    log_test("Diagnose endpoint auth check", False, f"Exception: {str(e)}")

# ============================================================================
# Test 4: GET /api/admin/sales/transactions (without filters)
# ============================================================================
print("\n" + "="*80)
print("TEST 4: GET /api/admin/sales/transactions (without filters)")
print("="*80)

try:
    response = session.get(
        f"{BASE_URL}/admin/sales/transactions",
        timeout=10
    )
    
    if response.status_code == 200:
        data = response.json()
        
        # Verify response shape
        required_keys = ["transactions", "total", "page", "limit", "total_pages"]
        has_all_keys = all(key in data for key in required_keys)
        
        if has_all_keys:
            log_test("Transactions endpoint returns correct structure", True,
                    f"Has all required keys: {required_keys}")
            
            # Verify types
            is_array = isinstance(data.get("transactions"), list)
            is_int_total = isinstance(data.get("total"), int)
            is_int_page = isinstance(data.get("page"), int)
            is_int_limit = isinstance(data.get("limit"), int)
            is_int_total_pages = isinstance(data.get("total_pages"), int)
            
            all_types_correct = is_array and is_int_total and is_int_page and is_int_limit and is_int_total_pages
            log_test("Transactions endpoint field types correct", all_types_correct,
                    f"transactions: list={is_array}, total: int={is_int_total}, page: int={is_int_page}, limit: int={is_int_limit}, total_pages: int={is_int_total_pages}")
            
            print(f"   Total transactions: {data.get('total', 0)}")
            print(f"   Page: {data.get('page', 0)}")
            print(f"   Limit: {data.get('limit', 0)}")
            print(f"   Total pages: {data.get('total_pages', 0)}")
        else:
            log_test("Transactions endpoint structure", False,
                    f"Missing keys. Got: {list(data.keys())}")
    else:
        log_test("Transactions endpoint", False,
                f"Status {response.status_code}: {response.text[:200]}")
except Exception as e:
    log_test("Transactions endpoint", False, f"Exception: {str(e)}")

# ============================================================================
# Test 5: GET /api/admin/sales/transactions with status=paid
# ============================================================================
print("\n" + "="*80)
print("TEST 5: GET /api/admin/sales/transactions with status=paid")
print("="*80)

try:
    response = session.get(
        f"{BASE_URL}/admin/sales/transactions",
        params={"status": "paid"},
        timeout=10
    )
    
    if response.status_code == 200:
        data = response.json()
        has_all_keys = all(key in data for key in ["transactions", "total", "page", "limit", "total_pages"])
        log_test("Transactions endpoint with status=paid", has_all_keys,
                f"Total: {data.get('total', 0)}")
    else:
        log_test("Transactions endpoint with status=paid", False,
                f"Status {response.status_code}")
except Exception as e:
    log_test("Transactions endpoint with status=paid", False, f"Exception: {str(e)}")

# ============================================================================
# Test 6: GET /api/admin/sales/transactions with status=pending
# ============================================================================
print("\n" + "="*80)
print("TEST 6: GET /api/admin/sales/transactions with status=pending")
print("="*80)

try:
    response = session.get(
        f"{BASE_URL}/admin/sales/transactions",
        params={"status": "pending"},
        timeout=10
    )
    
    if response.status_code == 200:
        data = response.json()
        has_all_keys = all(key in data for key in ["transactions", "total", "page", "limit", "total_pages"])
        log_test("Transactions endpoint with status=pending", has_all_keys,
                f"Total: {data.get('total', 0)}")
    else:
        log_test("Transactions endpoint with status=pending", False,
                f"Status {response.status_code}")
except Exception as e:
    log_test("Transactions endpoint with status=pending", False, f"Exception: {str(e)}")

# ============================================================================
# Test 7: GET /api/admin/sales/transactions with purchase_type filter
# ============================================================================
print("\n" + "="*80)
print("TEST 7: GET /api/admin/sales/transactions with purchase_type=Coaching Plan")
print("="*80)

try:
    response = session.get(
        f"{BASE_URL}/admin/sales/transactions",
        params={"purchase_type": "Coaching Plan"},
        timeout=10
    )
    
    if response.status_code == 200:
        data = response.json()
        has_all_keys = all(key in data for key in ["transactions", "total", "page", "limit", "total_pages"])
        log_test("Transactions endpoint with purchase_type filter", has_all_keys,
                f"Total: {data.get('total', 0)}")
    else:
        log_test("Transactions endpoint with purchase_type filter", False,
                f"Status {response.status_code}")
except Exception as e:
    log_test("Transactions endpoint with purchase_type filter", False, f"Exception: {str(e)}")

# ============================================================================
# Test 8: Synthetic test - Dedup logic (same razorpay_order_id)
# ============================================================================
print("\n" + "="*80)
print("TEST 8: Synthetic test - Dedup logic (same razorpay_order_id)")
print("="*80)

try:
    # Connect to MongoDB
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Generate unique IDs for this test
    test_order_id = f"order_test_dedup_{datetime.now(timezone.utc).timestamp()}"
    test_payment_id = f"pay_test_dedup_{datetime.now(timezone.utc).timestamp()}"
    test_user_id = "test-user-dedup"
    current_time = datetime.now(timezone.utc).isoformat()
    
    # Insert into payment_orders
    payment_order = {
        "id": f"po_{test_order_id}",
        "razorpay_order_id": test_order_id,
        "razorpay_payment_id": test_payment_id,
        "status": "paid",
        "user_id": test_user_id,
        "amount": 1000,
        "plan_key": "basic_plan",
        "plan_name": "Basic Plan",
        "created_at": current_time,
        "paid_at": current_time
    }
    db.payment_orders.insert_one(payment_order)
    print(f"   Inserted payment_order: {payment_order['id']}")
    
    # Insert into payments with SAME razorpay_order_id
    payment = {
        "id": f"payment_{test_payment_id}",
        "razorpay_order_id": test_order_id,  # SAME as payment_order
        "razorpay_payment_id": test_payment_id,
        "status": "captured",
        "user_id": test_user_id,
        "amount": 1000,
        "type": "subscription",
        "created_at": current_time,
        "captured_at": current_time
    }
    db.payments.insert_one(payment)
    print(f"   Inserted payment: {payment['id']}")
    
    # Call transactions endpoint
    response = session.get(
        f"{BASE_URL}/admin/sales/transactions",
        timeout=10
    )
    
    if response.status_code == 200:
        data = response.json()
        total = data.get("total", 0)
        transactions = data.get("transactions", [])
        
        # Find our test transaction
        test_transactions = [t for t in transactions if t.get("razorpay_order_id") == test_order_id]
        
        if len(test_transactions) == 1:
            log_test("Dedup logic works correctly (same order_id)", True,
                    f"Found exactly 1 transaction (not 0, not 2) for order_id={test_order_id}")
            
            # Verify it's from payment_orders (preferred source)
            test_tx = test_transactions[0]
            if test_tx.get("plan_key") == "basic_plan":
                log_test("Dedup prefers payment_orders data", True,
                        f"Transaction has plan_key from payment_orders")
            else:
                log_test("Dedup prefers payment_orders data", False,
                        f"Transaction missing payment_orders data")
        elif len(test_transactions) == 0:
            log_test("Dedup logic (same order_id)", False,
                    f"Expected 1 transaction, found 0. Dedup is filtering both sides!")
        elif len(test_transactions) == 2:
            log_test("Dedup logic (same order_id)", False,
                    f"Expected 1 transaction, found 2. Dedup not working!")
        else:
            log_test("Dedup logic (same order_id)", False,
                    f"Expected 1 transaction, found {len(test_transactions)}")
    else:
        log_test("Dedup logic test", False,
                f"Status {response.status_code}")
    
    # Cleanup
    db.payment_orders.delete_one({"id": payment_order["id"]})
    db.payments.delete_one({"id": payment["id"]})
    print(f"   Cleaned up test records")
    
except Exception as e:
    log_test("Dedup logic test", False, f"Exception: {str(e)}")
    # Try to cleanup on error
    try:
        db.payment_orders.delete_many({"user_id": test_user_id})
        db.payments.delete_many({"user_id": test_user_id})
    except:
        pass

# ============================================================================
# Test 9: Synthetic test - Non-duplicate case (different order_ids)
# ============================================================================
print("\n" + "="*80)
print("TEST 9: Synthetic test - Non-duplicate case (different order_ids)")
print("="*80)

try:
    # Generate unique IDs for this test
    test_order_id_1 = f"order_X_{datetime.now(timezone.utc).timestamp()}"
    test_order_id_2 = f"order_Y_{datetime.now(timezone.utc).timestamp()}"
    test_user_id_1 = "test-user-1"
    test_user_id_2 = "test-user-2"
    current_time = datetime.now(timezone.utc).isoformat()
    
    # Insert into payment_orders with order_X
    payment_order_1 = {
        "id": f"po_{test_order_id_1}",
        "razorpay_order_id": test_order_id_1,
        "razorpay_payment_id": f"pay_{test_order_id_1}",
        "status": "paid",
        "user_id": test_user_id_1,
        "amount": 500,
        "plan_key": "basic_plan",
        "plan_name": "Basic Plan",
        "created_at": current_time,
        "paid_at": current_time
    }
    db.payment_orders.insert_one(payment_order_1)
    print(f"   Inserted payment_order: {payment_order_1['id']} with order_id={test_order_id_1}")
    
    # Insert into payments with order_Y (DIFFERENT)
    payment_2 = {
        "id": f"payment_{test_order_id_2}",
        "razorpay_order_id": test_order_id_2,  # DIFFERENT order_id
        "razorpay_payment_id": f"pay_{test_order_id_2}",
        "status": "captured",
        "user_id": test_user_id_2,
        "amount": 700,
        "type": "subscription",
        "created_at": current_time,
        "captured_at": current_time
    }
    db.payments.insert_one(payment_2)
    print(f"   Inserted payment: {payment_2['id']} with order_id={test_order_id_2}")
    
    # Call transactions endpoint
    response = session.get(
        f"{BASE_URL}/admin/sales/transactions",
        timeout=10
    )
    
    if response.status_code == 200:
        data = response.json()
        transactions = data.get("transactions", [])
        
        # Find our test transactions
        test_transactions = [t for t in transactions if 
                           t.get("razorpay_order_id") in [test_order_id_1, test_order_id_2]]
        
        if len(test_transactions) == 2:
            log_test("Non-duplicate case works correctly", True,
                    f"Found exactly 2 transactions for different order_ids")
            
            # Verify both are present
            order_ids = [t.get("razorpay_order_id") for t in test_transactions]
            has_both = test_order_id_1 in order_ids and test_order_id_2 in order_ids
            log_test("Both non-duplicate transactions present", has_both,
                    f"Order IDs: {order_ids}")
        else:
            log_test("Non-duplicate case", False,
                    f"Expected 2 transactions, found {len(test_transactions)}")
    else:
        log_test("Non-duplicate case test", False,
                f"Status {response.status_code}")
    
    # Cleanup
    db.payment_orders.delete_one({"id": payment_order_1["id"]})
    db.payments.delete_one({"id": payment_2["id"]})
    print(f"   Cleaned up test records")
    
except Exception as e:
    log_test("Non-duplicate case test", False, f"Exception: {str(e)}")
    # Try to cleanup on error
    try:
        db.payment_orders.delete_many({"user_id": {"$in": [test_user_id_1, test_user_id_2]}})
        db.payments.delete_many({"user_id": {"$in": [test_user_id_1, test_user_id_2]}})
    except:
        pass

# ============================================================================
# Print Summary
# ============================================================================
print_summary()

# Exit with appropriate code
exit(0 if test_results["failed"] == 0 else 1)
