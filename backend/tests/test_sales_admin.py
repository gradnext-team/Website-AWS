"""
Test Sales Admin API Endpoints
Tests for comprehensive sales tracking, GST breakdown, user purchase history, and export functionality
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Admin credentials
ADMIN_EMAIL = "admin@gradnext.com"
ADMIN_PASSWORD = "admin123"


class TestSalesAdminAuth:
    """Test admin authentication for sales endpoints"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Get authenticated admin session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        
        if login_response.status_code != 200:
            pytest.skip(f"Admin login failed: {login_response.status_code} - {login_response.text}")
        
        return session
    
    def test_admin_login_success(self, admin_session):
        """Test admin can login successfully"""
        # Verify session is authenticated
        me_response = admin_session.get(f"{BASE_URL}/api/auth/me")
        assert me_response.status_code == 200
        data = me_response.json()
        assert data.get("is_admin") == True or data.get("email") == ADMIN_EMAIL
        print(f"Admin login successful: {data.get('email')}")


class TestSalesSummary:
    """Test sales summary endpoint"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Get authenticated admin session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        
        if login_response.status_code != 200:
            pytest.skip(f"Admin login failed: {login_response.status_code}")
        
        return session
    
    def test_get_sales_summary(self, admin_session):
        """Test GET /api/admin/sales/summary returns revenue stats"""
        response = admin_session.get(f"{BASE_URL}/api/admin/sales/summary")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify required fields exist
        assert "total_revenue" in data
        assert "total_base_amount" in data
        assert "total_gst" in data
        assert "today_revenue" in data
        assert "week_revenue" in data
        assert "month_revenue" in data
        assert "transaction_count" in data
        assert "average_order_value" in data
        assert "revenue_by_type" in data
        assert "gst_rate" in data
        
        # Verify GST rate is 18%
        assert data["gst_rate"] == 18
        
        # Verify numeric types
        assert isinstance(data["total_revenue"], (int, float))
        assert isinstance(data["transaction_count"], int)
        
        print(f"Sales Summary: Total Revenue={data['total_revenue']}, Transactions={data['transaction_count']}")
    
    def test_sales_summary_gst_calculation(self, admin_session):
        """Test GST breakdown is calculated correctly"""
        response = admin_session.get(f"{BASE_URL}/api/admin/sales/summary")
        
        assert response.status_code == 200
        data = response.json()
        
        # If there's revenue, verify GST calculation
        if data["total_revenue"] > 0:
            # GST should be approximately 18% of base amount
            expected_gst = data["total_base_amount"] * 0.18
            # Allow small rounding difference
            assert abs(data["total_gst"] - expected_gst) < 1, f"GST mismatch: {data['total_gst']} vs expected {expected_gst}"
            
            # Total should equal base + GST
            expected_total = data["total_base_amount"] + data["total_gst"]
            assert abs(data["total_revenue"] - expected_total) < 1, f"Total mismatch: {data['total_revenue']} vs {expected_total}"
        
        print(f"GST Calculation: Base={data['total_base_amount']}, GST={data['total_gst']}, Total={data['total_revenue']}")


class TestSalesTransactions:
    """Test sales transactions endpoint"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Get authenticated admin session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        
        if login_response.status_code != 200:
            pytest.skip(f"Admin login failed: {login_response.status_code}")
        
        return session
    
    def test_get_transactions_default(self, admin_session):
        """Test GET /api/admin/sales/transactions returns paginated list"""
        response = admin_session.get(f"{BASE_URL}/api/admin/sales/transactions")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify pagination structure
        assert "transactions" in data
        assert "total" in data
        assert "page" in data
        assert "limit" in data
        assert "total_pages" in data
        
        assert isinstance(data["transactions"], list)
        assert data["page"] == 1
        assert data["limit"] == 20
        
        print(f"Transactions: {data['total']} total, page {data['page']} of {data['total_pages']}")
    
    def test_transactions_have_gst_breakdown(self, admin_session):
        """Test each transaction has GST breakdown"""
        response = admin_session.get(f"{BASE_URL}/api/admin/sales/transactions")
        
        assert response.status_code == 200
        data = response.json()
        
        if data["transactions"]:
            tx = data["transactions"][0]
            
            # Verify GST fields
            assert "base_amount" in tx
            assert "gst" in tx
            assert "total_amount" in tx
            assert "purchase_type" in tx
            assert "purchase_name" in tx
            assert "status" in tx
            
            # Verify user info
            assert "user" in tx or "user_email" in tx
            
            print(f"Transaction sample: Type={tx['purchase_type']}, Total={tx['total_amount']}, GST={tx['gst']}")
    
    def test_filter_by_purchase_type(self, admin_session):
        """Test filtering transactions by purchase type"""
        # First get purchase types
        types_response = admin_session.get(f"{BASE_URL}/api/admin/sales/purchase-types")
        assert types_response.status_code == 200
        purchase_types = types_response.json().get("purchase_types", [])
        
        if purchase_types:
            # Filter by first available type
            test_type = purchase_types[0]
            response = admin_session.get(
                f"{BASE_URL}/api/admin/sales/transactions",
                params={"purchase_type": test_type}
            )
            
            assert response.status_code == 200
            data = response.json()
            
            # All returned transactions should match the filter
            for tx in data["transactions"]:
                assert tx["purchase_type"] == test_type, f"Expected {test_type}, got {tx['purchase_type']}"
            
            print(f"Filter by type '{test_type}': {len(data['transactions'])} transactions")
    
    def test_filter_by_status(self, admin_session):
        """Test filtering transactions by status"""
        response = admin_session.get(
            f"{BASE_URL}/api/admin/sales/transactions",
            params={"status": "paid"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # All returned transactions should be paid
        for tx in data["transactions"]:
            assert tx["status"] == "paid", f"Expected paid, got {tx['status']}"
        
        print(f"Filter by status 'paid': {len(data['transactions'])} transactions")
    
    def test_search_by_name_or_email(self, admin_session):
        """Test search functionality"""
        # First get a transaction to get a user name/email
        response = admin_session.get(f"{BASE_URL}/api/admin/sales/transactions")
        assert response.status_code == 200
        data = response.json()
        
        if data["transactions"]:
            tx = data["transactions"][0]
            search_term = tx.get("user", {}).get("email", "") or tx.get("user_email", "")
            
            if search_term:
                # Search by email
                search_response = admin_session.get(
                    f"{BASE_URL}/api/admin/sales/transactions",
                    params={"search": search_term[:5]}  # Use partial match
                )
                
                assert search_response.status_code == 200
                print(f"Search for '{search_term[:5]}': {search_response.json()['total']} results")
    
    def test_pagination(self, admin_session):
        """Test pagination works correctly"""
        # Get page 1
        page1_response = admin_session.get(
            f"{BASE_URL}/api/admin/sales/transactions",
            params={"page": 1, "limit": 5}
        )
        
        assert page1_response.status_code == 200
        page1_data = page1_response.json()
        
        assert page1_data["page"] == 1
        assert page1_data["limit"] == 5
        assert len(page1_data["transactions"]) <= 5
        
        print(f"Pagination: Page 1 has {len(page1_data['transactions'])} items, total {page1_data['total']}")


class TestPurchaseTypes:
    """Test purchase types endpoint"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Get authenticated admin session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        
        if login_response.status_code != 200:
            pytest.skip(f"Admin login failed: {login_response.status_code}")
        
        return session
    
    def test_get_purchase_types(self, admin_session):
        """Test GET /api/admin/sales/purchase-types returns list"""
        response = admin_session.get(f"{BASE_URL}/api/admin/sales/purchase-types")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "purchase_types" in data
        assert isinstance(data["purchase_types"], list)
        assert len(data["purchase_types"]) > 0
        
        # Verify expected types are present
        expected_types = ["Subscription Plan", "Coaching Plan", "Single Session", "Top-Up"]
        for expected in expected_types:
            assert expected in data["purchase_types"], f"Missing type: {expected}"
        
        print(f"Purchase types: {data['purchase_types']}")


class TestUserPurchaseHistory:
    """Test user purchase history endpoint"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Get authenticated admin session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        
        if login_response.status_code != 200:
            pytest.skip(f"Admin login failed: {login_response.status_code}")
        
        return session
    
    def test_get_user_purchases(self, admin_session):
        """Test GET /api/admin/sales/users/{userId}/purchases"""
        # First get a user_id from transactions
        tx_response = admin_session.get(f"{BASE_URL}/api/admin/sales/transactions")
        assert tx_response.status_code == 200
        tx_data = tx_response.json()
        
        if not tx_data["transactions"]:
            pytest.skip("No transactions available to test user purchases")
        
        user_id = tx_data["transactions"][0].get("user_id")
        if not user_id:
            pytest.skip("No user_id in transaction")
        
        # Get user purchase history
        response = admin_session.get(f"{BASE_URL}/api/admin/sales/users/{user_id}/purchases")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "user" in data
        assert "summary" in data
        assert "purchases" in data
        
        # Verify user info
        user = data["user"]
        assert "id" in user
        assert "name" in user
        assert "email" in user
        
        # Verify summary
        summary = data["summary"]
        assert "total_spent" in summary
        assert "total_gst_paid" in summary
        assert "purchase_count" in summary
        assert "purchases_by_type" in summary
        
        print(f"User {user['name']}: {summary['purchase_count']} purchases, total spent {summary['total_spent']}")
    
    def test_user_not_found(self, admin_session):
        """Test 404 for non-existent user"""
        response = admin_session.get(f"{BASE_URL}/api/admin/sales/users/non-existent-user-id/purchases")
        
        assert response.status_code == 404
        print("User not found returns 404 as expected")


class TestExportSales:
    """Test sales export endpoint"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Get authenticated admin session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        
        if login_response.status_code != 200:
            pytest.skip(f"Admin login failed: {login_response.status_code}")
        
        return session
    
    def test_export_csv(self, admin_session):
        """Test GET /api/admin/sales/export returns CSV"""
        response = admin_session.get(
            f"{BASE_URL}/api/admin/sales/export",
            params={"format": "csv"}
        )
        
        assert response.status_code == 200
        
        # Check content type
        content_type = response.headers.get("content-type", "")
        assert "text/csv" in content_type, f"Expected CSV, got {content_type}"
        
        # Check content disposition
        content_disp = response.headers.get("content-disposition", "")
        assert "attachment" in content_disp
        assert ".csv" in content_disp
        
        # Verify CSV has headers
        csv_content = response.text
        assert "Transaction ID" in csv_content or "Customer Name" in csv_content
        
        print(f"CSV export successful, {len(csv_content)} bytes")
    
    def test_export_json(self, admin_session):
        """Test GET /api/admin/sales/export with JSON format"""
        response = admin_session.get(
            f"{BASE_URL}/api/admin/sales/export",
            params={"format": "json"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "data" in data
        assert "count" in data
        assert isinstance(data["data"], list)
        
        print(f"JSON export: {data['count']} records")
    
    def test_export_with_filters(self, admin_session):
        """Test export with date and type filters"""
        response = admin_session.get(
            f"{BASE_URL}/api/admin/sales/export",
            params={
                "format": "json",
                "status": "paid"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # All exported records should be paid
        for record in data["data"]:
            assert record.get("Status") == "paid"
        
        print(f"Filtered export: {data['count']} paid records")


class TestUnauthorizedAccess:
    """Test that non-admin users cannot access sales endpoints"""
    
    def test_summary_requires_admin(self):
        """Test sales summary requires admin auth"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/admin/sales/summary")
        
        # Should return 401 or 403
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("Unauthorized access to summary blocked")
    
    def test_transactions_requires_admin(self):
        """Test transactions endpoint requires admin auth"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/admin/sales/transactions")
        
        assert response.status_code in [401, 403]
        print("Unauthorized access to transactions blocked")
    
    def test_export_requires_admin(self):
        """Test export endpoint requires admin auth"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/admin/sales/export")
        
        assert response.status_code in [401, 403]
        print("Unauthorized access to export blocked")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
