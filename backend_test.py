"""
Backend API Testing for CRM CSV Import Enhancement and Month Filter
Tests the following features:
1. CSV Import with First Call Date handling
2. Contact log creation for leads with First Call Date
3. Reach-outs grouping (to_be_reached_out, follow_up, closed)
4. Month filter on reach-outs endpoint
"""

import requests
import json
import io
import csv
from datetime import datetime, timedelta
import os

# Backend URL from environment
BACKEND_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://consultant-gateway.preview.emergentagent.com")
BASE_URL = f"{BACKEND_URL}/api"

# Test session
session = requests.Session()

def print_test(name):
    """Print test name"""
    print(f"\n{'='*80}")
    print(f"TEST: {name}")
    print('='*80)

def print_result(success, message):
    """Print test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")

def authenticate_admin():
    """Authenticate as admin using mock login"""
    print_test("Authentication - Admin Mock Login")
    
    url = f"{BASE_URL}/auth/mock-login"
    params = {"user_type": "admin"}
    
    response = session.post(url, params=params)
    
    if response.status_code == 200:
        data = response.json()
        print_result(True, f"Authenticated as admin: {data.get('user', {}).get('email')}")
        return True
    else:
        print_result(False, f"Authentication failed: {response.status_code} - {response.text}")
        return False

def create_test_csv():
    """Create test CSV file with First Call Date column"""
    print_test("Creating Test CSV File")
    
    csv_content = """Name,Email,Phone,First Call Date,Call Status,Lead Status,POC,UG College,Plan Purchased,Amount,Remarks
John Doe,john.doe.test@example.com,+919876543210,15/03/2026,Reached,Active,Rahul,IIT Delhi,,,Good lead
Jane Smith,jane.smith.test@example.com,+919876543211,,,,,,,,New signup
Bob Wilson,bob.wilson.test@example.com,+919876543212,2026-04-10,Not Reached,,Priya,BITS Pilani,,,Called once
Alice Won,alice.won.test@example.com,+919876543213,01/02/2026,Interested,Won,Rahul,,Full Prep,25000,Converted
Charlie Lost,charlie.lost.test@example.com,+919876543214,10/03/2026,Not Interested,Lost,Priya,NIT Trichy,,,Not interested"""
    
    csv_file = io.BytesIO(csv_content.encode('utf-8'))
    csv_file.name = 'test_import.csv'
    
    print_result(True, "Test CSV created with 5 leads (3 with First Call Date, 2 without)")
    return csv_file

def test_csv_import():
    """Test 1: CSV Import with First Call Date"""
    print_test("Test 1: CSV Import with First Call Date")
    
    csv_file = create_test_csv()
    csv_file.seek(0)
    
    url = f"{BASE_URL}/crm/leads/import-csv"
    files = {'file': ('test_import.csv', csv_file, 'text/csv')}
    
    response = session.post(url, files=files)
    
    if response.status_code == 200:
        data = response.json()
        imported = data.get('imported', 0)
        contacted = data.get('contacted', 0)
        
        print(f"Response: {json.dumps(data, indent=2)}")
        
        # Verify imported count
        if imported >= 4:
            print_result(True, f"Imported {imported} leads successfully")
        else:
            print_result(False, f"Expected at least 4 imported, got {imported}")
            return None
        
        # Verify contacted count
        if contacted >= 3:
            print_result(True, f"Marked {contacted} leads as contacted (with First Call Date)")
        else:
            print_result(False, f"Expected at least 3 contacted, got {contacted}")
            return None
        
        return data
    else:
        print_result(False, f"CSV import failed: {response.status_code} - {response.text}")
        return None

def get_leads():
    """Get all leads"""
    url = f"{BASE_URL}/crm/leads"
    response = session.get(url, params={"limit": 500})
    
    if response.status_code == 200:
        data = response.json()
        return data.get('leads', [])
    else:
        print_result(False, f"Failed to get leads: {response.status_code}")
        return []

def test_contact_logs():
    """Test 2: Verify Contact Logs Created"""
    print_test("Test 2: Verify Contact Logs Created for Leads with First Call Date")
    
    leads = get_leads()
    
    # Find our test leads
    john = next((l for l in leads if 'john.doe.test@example.com' in (l.get('email') or '')), None)
    jane = next((l for l in leads if 'jane.smith.test@example.com' in (l.get('email') or '')), None)
    bob = next((l for l in leads if 'bob.wilson.test@example.com' in (l.get('email') or '')), None)
    alice = next((l for l in leads if 'alice.won.test@example.com' in (l.get('email') or '')), None)
    
    results = []
    
    # Test John (has First Call Date)
    if john:
        url = f"{BASE_URL}/crm/contact-logs"
        response = session.get(url, params={"lead_id": john['id']})
        
        if response.status_code == 200:
            logs = response.json().get('logs', [])
            if len(logs) > 0:
                print_result(True, f"John Doe: Found {len(logs)} contact log(s)")
                # Verify method is 'call'
                if logs[0].get('method') == 'call':
                    print_result(True, f"John Doe: Contact log method is 'call'")
                else:
                    print_result(False, f"John Doe: Expected method='call', got '{logs[0].get('method')}'")
                results.append(True)
            else:
                print_result(False, f"John Doe: No contact logs found (expected at least 1)")
                results.append(False)
        else:
            print_result(False, f"John Doe: Failed to get contact logs: {response.status_code}")
            results.append(False)
    else:
        print_result(False, "John Doe lead not found")
        results.append(False)
    
    # Test Bob (has First Call Date)
    if bob:
        url = f"{BASE_URL}/crm/contact-logs"
        response = session.get(url, params={"lead_id": bob['id']})
        
        if response.status_code == 200:
            logs = response.json().get('logs', [])
            if len(logs) > 0:
                print_result(True, f"Bob Wilson: Found {len(logs)} contact log(s)")
                results.append(True)
            else:
                print_result(False, f"Bob Wilson: No contact logs found (expected at least 1)")
                results.append(False)
        else:
            print_result(False, f"Bob Wilson: Failed to get contact logs: {response.status_code}")
            results.append(False)
    else:
        print_result(False, "Bob Wilson lead not found")
        results.append(False)
    
    # Test Alice (has First Call Date, status=won)
    if alice:
        url = f"{BASE_URL}/crm/contact-logs"
        response = session.get(url, params={"lead_id": alice['id']})
        
        if response.status_code == 200:
            logs = response.json().get('logs', [])
            if len(logs) > 0:
                print_result(True, f"Alice Won: Found {len(logs)} contact log(s)")
                results.append(True)
            else:
                print_result(False, f"Alice Won: No contact logs found (expected at least 1)")
                results.append(False)
        else:
            print_result(False, f"Alice Won: Failed to get contact logs: {response.status_code}")
            results.append(False)
    else:
        print_result(False, "Alice Won lead not found")
        results.append(False)
    
    # Test Jane (NO First Call Date)
    if jane:
        url = f"{BASE_URL}/crm/contact-logs"
        response = session.get(url, params={"lead_id": jane['id']})
        
        if response.status_code == 200:
            logs = response.json().get('logs', [])
            if len(logs) == 0:
                print_result(True, f"Jane Smith: No contact logs (as expected)")
                results.append(True)
            else:
                print_result(False, f"Jane Smith: Found {len(logs)} contact log(s) (expected 0)")
                results.append(False)
        else:
            print_result(False, f"Jane Smith: Failed to get contact logs: {response.status_code}")
            results.append(False)
    else:
        print_result(False, "Jane Smith lead not found")
        results.append(False)
    
    return all(results)

def test_reach_outs_grouping():
    """Test 3: Reach-Outs Grouping"""
    print_test("Test 3: Reach-Outs Grouping (to_be_reached_out, follow_up, closed)")
    
    url = f"{BASE_URL}/crm/leads/reach-outs"
    response = session.get(url)
    
    if response.status_code != 200:
        print_result(False, f"Failed to get reach-outs: {response.status_code} - {response.text}")
        return False
    
    data = response.json()
    groups = data.get('groups', {})
    totals = data.get('totals', {})
    
    print(f"Totals: {json.dumps(totals, indent=2)}")
    
    to_be_reached = groups.get('to_be_reached_out', [])
    follow_up = groups.get('follow_up', [])
    closed = groups.get('closed', [])
    
    results = []
    
    # Check Jane (no call date) should be in "to_be_reached_out"
    jane_in_to_be_reached = any('jane.smith.test@example.com' in (l.get('email') or '') for l in to_be_reached)
    if jane_in_to_be_reached:
        print_result(True, "Jane Smith (no call date) is in 'to_be_reached_out' group")
        results.append(True)
    else:
        print_result(False, "Jane Smith should be in 'to_be_reached_out' group")
        results.append(False)
    
    # Check John (active with call date) should be in "follow_up"
    john_in_follow_up = any('john.doe.test@example.com' in (l.get('email') or '') for l in follow_up)
    if john_in_follow_up:
        print_result(True, "John Doe (active with call date) is in 'follow_up' group")
        results.append(True)
    else:
        print_result(False, "John Doe should be in 'follow_up' group")
        results.append(False)
    
    # Check Bob (active with call date) should be in "follow_up"
    bob_in_follow_up = any('bob.wilson.test@example.com' in (l.get('email') or '') for l in follow_up)
    if bob_in_follow_up:
        print_result(True, "Bob Wilson (active with call date) is in 'follow_up' group")
        results.append(True)
    else:
        print_result(False, "Bob Wilson should be in 'follow_up' group")
        results.append(False)
    
    # Check Alice (won status) should be in "closed"
    alice_in_closed = any('alice.won.test@example.com' in (l.get('email') or '') for l in closed)
    if alice_in_closed:
        print_result(True, "Alice Won (won status) is in 'closed' group")
        results.append(True)
    else:
        print_result(False, "Alice Won should be in 'closed' group")
        results.append(False)
    
    # Check Charlie (lost status) should be in "closed"
    charlie_in_closed = any('charlie.lost.test@example.com' in (l.get('email') or '') for l in closed)
    if charlie_in_closed:
        print_result(True, "Charlie Lost (lost status) is in 'closed' group")
        results.append(True)
    else:
        print_result(False, "Charlie Lost should be in 'closed' group")
        results.append(False)
    
    return all(results)

def test_month_filter():
    """Test 4: Month Filter on Reach-Outs"""
    print_test("Test 4: Month Filter on Reach-Outs Endpoint")
    
    results = []
    
    # Test 4a: Current month filter (2026-05)
    print("\n--- Test 4a: month_filter=2026-05 (current month) ---")
    url = f"{BASE_URL}/crm/leads/reach-outs"
    response = session.get(url, params={"month_filter": "2026-05"})
    
    if response.status_code == 200:
        data = response.json()
        totals = data.get('totals', {})
        total_leads = sum(totals.values())
        
        print(f"Totals for May 2026: {json.dumps(totals, indent=2)}")
        
        # Our test leads were created just now (May 2026), so they should appear
        if total_leads >= 5:
            print_result(True, f"Found {total_leads} leads created in May 2026")
            results.append(True)
        else:
            print_result(False, f"Expected at least 5 leads in May 2026, got {total_leads}")
            results.append(False)
    else:
        print_result(False, f"Failed to get reach-outs with month_filter: {response.status_code}")
        results.append(False)
    
    # Test 4b: Past month filter (2026-01)
    print("\n--- Test 4b: month_filter=2026-01 (January 2026) ---")
    response = session.get(url, params={"month_filter": "2026-01"})
    
    if response.status_code == 200:
        data = response.json()
        totals = data.get('totals', {})
        total_leads = sum(totals.values())
        
        print(f"Totals for January 2026: {json.dumps(totals, indent=2)}")
        
        # No leads should be from January (our test leads are from May)
        if total_leads == 0:
            print_result(True, f"Correctly returned 0 leads for January 2026")
            results.append(True)
        else:
            print_result(False, f"Expected 0 leads for January 2026, got {total_leads}")
            results.append(False)
    else:
        print_result(False, f"Failed to get reach-outs with month_filter: {response.status_code}")
        results.append(False)
    
    # Test 4c: "any" filter (should return all leads)
    print("\n--- Test 4c: month_filter=any (all months) ---")
    response = session.get(url, params={"month_filter": "any"})
    
    if response.status_code == 200:
        data = response.json()
        totals = data.get('totals', {})
        total_leads = sum(totals.values())
        
        print(f"Totals for all months: {json.dumps(totals, indent=2)}")
        
        if total_leads >= 5:
            print_result(True, f"Found {total_leads} leads with month_filter=any")
            results.append(True)
        else:
            print_result(False, f"Expected at least 5 leads with month_filter=any, got {total_leads}")
            results.append(False)
    else:
        print_result(False, f"Failed to get reach-outs with month_filter=any: {response.status_code}")
        results.append(False)
    
    # Test 4d: Invalid month filter (should be ignored gracefully)
    print("\n--- Test 4d: month_filter=invalid (should be ignored) ---")
    response = session.get(url, params={"month_filter": "invalid"})
    
    if response.status_code == 200:
        data = response.json()
        totals = data.get('totals', {})
        total_leads = sum(totals.values())
        
        print_result(True, f"Invalid month_filter handled gracefully, returned {total_leads} leads")
        results.append(True)
    else:
        print_result(False, f"Failed to handle invalid month_filter: {response.status_code}")
        results.append(False)
    
    return all(results)

def test_edge_cases():
    """Test 5: Edge Cases"""
    print_test("Test 5: Edge Cases - Call Status and Lead Status Mapping")
    
    results = []
    
    leads = get_leads()
    
    # Test Call Status mapping
    john = next((l for l in leads if 'john.doe.test@example.com' in (l.get('email') or '')), None)
    if john:
        url = f"{BASE_URL}/crm/contact-logs"
        response = session.get(url, params={"lead_id": john['id']})
        
        if response.status_code == 200:
            logs = response.json().get('logs', [])
            if logs:
                outcome = logs[0].get('outcome')
                # "Reached" should map to "reached"
                if outcome == 'reached':
                    print_result(True, f"Call Status 'Reached' correctly mapped to outcome 'reached'")
                    results.append(True)
                else:
                    print_result(False, f"Expected outcome 'reached', got '{outcome}'")
                    results.append(False)
    
    bob = next((l for l in leads if 'bob.wilson.test@example.com' in (l.get('email') or '')), None)
    if bob:
        url = f"{BASE_URL}/crm/contact-logs"
        response = session.get(url, params={"lead_id": bob['id']})
        
        if response.status_code == 200:
            logs = response.json().get('logs', [])
            if logs:
                outcome = logs[0].get('outcome')
                # "Not Reached" should map to "not_reached"
                if outcome == 'not_reached':
                    print_result(True, f"Call Status 'Not Reached' correctly mapped to outcome 'not_reached'")
                    results.append(True)
                else:
                    print_result(False, f"Expected outcome 'not_reached', got '{outcome}'")
                    results.append(False)
    
    # Test Lead Status mapping
    alice = next((l for l in leads if 'alice.won.test@example.com' in (l.get('email') or '')), None)
    if alice:
        status = alice.get('status')
        if status == 'won':
            print_result(True, f"Lead Status 'Won' correctly mapped to status 'won'")
            results.append(True)
        else:
            print_result(False, f"Expected status 'won', got '{status}'")
            results.append(False)
    
    charlie = next((l for l in leads if 'charlie.lost.test@example.com' in (l.get('email') or '')), None)
    if charlie:
        status = charlie.get('status')
        if status == 'lost':
            print_result(True, f"Lead Status 'Lost' correctly mapped to status 'lost'")
            results.append(True)
        else:
            print_result(False, f"Expected status 'lost', got '{status}'")
            results.append(False)
    
    return all(results) if results else False

def test_regression():
    """Test 6: Regression - Existing Functionality"""
    print_test("Test 6: Regression - Existing Reach-Outs Filters")
    
    results = []
    
    url = f"{BASE_URL}/crm/leads/reach-outs"
    
    # Test 6a: No filters (should work)
    print("\n--- Test 6a: No filters ---")
    response = session.get(url)
    
    if response.status_code == 200:
        data = response.json()
        print_result(True, f"Reach-outs without filters works: {sum(data.get('totals', {}).values())} leads")
        results.append(True)
    else:
        print_result(False, f"Reach-outs without filters failed: {response.status_code}")
        results.append(False)
    
    # Test 6b: created_filter=today
    print("\n--- Test 6b: created_filter=today ---")
    response = session.get(url, params={"created_filter": "today"})
    
    if response.status_code == 200:
        data = response.json()
        print_result(True, f"created_filter=today works: {sum(data.get('totals', {}).values())} leads")
        results.append(True)
    else:
        print_result(False, f"created_filter=today failed: {response.status_code}")
        results.append(False)
    
    # Test 6c: follow_up_filter=any
    print("\n--- Test 6c: follow_up_filter=any ---")
    response = session.get(url, params={"follow_up_filter": "any"})
    
    if response.status_code == 200:
        data = response.json()
        print_result(True, f"follow_up_filter=any works: {sum(data.get('totals', {}).values())} leads")
        results.append(True)
    else:
        print_result(False, f"follow_up_filter=any failed: {response.status_code}")
        results.append(False)
    
    return all(results)

def cleanup_test_leads():
    """Clean up test leads created during testing"""
    print_test("Cleanup: Removing Test Leads")
    
    leads = get_leads()
    test_emails = [
        'john.doe.test@example.com',
        'jane.smith.test@example.com',
        'bob.wilson.test@example.com',
        'alice.won.test@example.com',
        'charlie.lost.test@example.com'
    ]
    
    deleted_count = 0
    for lead in leads:
        if lead.get('email') in test_emails:
            url = f"{BASE_URL}/crm/leads/{lead['id']}"
            response = session.delete(url)
            if response.status_code == 200:
                deleted_count += 1
    
    print_result(True, f"Cleaned up {deleted_count} test leads")

def main():
    """Main test runner"""
    print("\n" + "="*80)
    print("CRM CSV IMPORT + MONTH FILTER TESTING")
    print("="*80)
    
    # Authenticate
    if not authenticate_admin():
        print("\n❌ AUTHENTICATION FAILED - Cannot proceed with tests")
        return
    
    # Run tests
    test_results = {}
    
    # Test 1: CSV Import
    import_result = test_csv_import()
    test_results['CSV Import'] = import_result is not None
    
    # Test 2: Contact Logs
    test_results['Contact Logs'] = test_contact_logs()
    
    # Test 3: Reach-Outs Grouping
    test_results['Reach-Outs Grouping'] = test_reach_outs_grouping()
    
    # Test 4: Month Filter
    test_results['Month Filter'] = test_month_filter()
    
    # Test 5: Edge Cases
    test_results['Edge Cases'] = test_edge_cases()
    
    # Test 6: Regression
    test_results['Regression'] = test_regression()
    
    # Cleanup
    cleanup_test_leads()
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    for test_name, passed in test_results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    total_tests = len(test_results)
    passed_tests = sum(1 for p in test_results.values() if p)
    
    print(f"\nTotal: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("\n🎉 ALL TESTS PASSED!")
    else:
        print(f"\n⚠️  {total_tests - passed_tests} test(s) failed")

if __name__ == "__main__":
    main()
