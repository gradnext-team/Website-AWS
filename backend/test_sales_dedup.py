"""
Test script to verify sales deduplication logic
"""

def test_deduplication():
    """Simulate the deduplication logic"""
    
    # Simulate payment_orders (paid/completed status)
    paid_orders = [
        {"id": "order1", "order_id": "rzp_order_123", "user_id": "user1", "plan_key": "pro_plan", "amount": 1000, "status": "paid"},
        {"id": "order2", "order_id": "rzp_order_456", "user_id": "user2", "plan_key": "basic_plan", "amount": 500, "status": "completed"},
    ]
    
    # Simulate payments (captured status) - includes DUPLICATES
    captured_payments = [
        # DUPLICATE of order1 (same order_id)
        {"id": "order1", "order_id": "rzp_order_123", "razorpay_order_id": "rzp_order_123", "user_id": "user1", "plan_key": "pro_plan", "amount": 1000, "status": "captured"},
        # DUPLICATE of order2 (same user + plan_key)
        {"id": "payment2", "order_id": "rzp_order_456", "user_id": "user2", "plan_key": "basic_plan", "amount": 500, "status": "captured"},
        # NEW payment (not in payment_orders)
        {"id": "payment3", "order_id": "rzp_order_789", "razorpay_order_id": "rzp_order_789", "user_id": "user3", "plan_key": "pro_plus", "amount": 2000, "status": "captured"},
    ]
    
    # DEDUPLICATION LOGIC (same as in sales_admin.py)
    existing_keys = set()
    for order in paid_orders:
        order_id = order.get("order_id") or order.get("razorpay_order_id", "")
        payment_id = order.get("id", "")
        user_type_key = f"{order.get('user_id', '')}_{order.get('plan_key', '')}"
        
        if order_id:
            existing_keys.add(f"order:{order_id}")
        if payment_id:
            existing_keys.add(f"id:{payment_id}")
        if order.get('user_id') and order.get('plan_key'):
            existing_keys.add(f"user_plan:{user_type_key}")
    
    deduplicated_payments = []
    for payment in captured_payments:
        order_id = payment.get("order_id") or payment.get("razorpay_order_id", "")
        payment_id = payment.get("id", "")
        user_type_key = f"{payment.get('user_id', '')}_{payment.get('plan_key', '')}"
        
        is_duplicate = False
        if order_id and f"order:{order_id}" in existing_keys:
            is_duplicate = True
            print(f"✓ Detected duplicate by order_id: {order_id}")
        if payment_id and f"id:{payment_id}" in existing_keys:
            is_duplicate = True
            print(f"✓ Detected duplicate by id: {payment_id}")
        if payment.get('user_id') and payment.get('plan_key') and f"user_plan:{user_type_key}" in existing_keys:
            is_duplicate = True
            print(f"✓ Detected duplicate by user+plan: {user_type_key}")
        
        if not is_duplicate:
            deduplicated_payments.append(payment)
            print(f"✓ Kept unique payment: {payment.get('id')}")
    
    # Merge results
    all_orders = paid_orders + deduplicated_payments
    
    # Calculate totals
    total_revenue = sum(order.get("amount", 0) for order in all_orders)
    
    print(f"\n--- Results ---")
    print(f"payment_orders count: {len(paid_orders)}")
    print(f"captured_payments count (before dedup): {len(captured_payments)}")
    print(f"captured_payments count (after dedup): {len(deduplicated_payments)}")
    print(f"Total transactions (after dedup): {len(all_orders)}")
    print(f"Total revenue: ₹{total_revenue}")
    print(f"\nExpected: 3 transactions, ₹3500 total")
    print(f"Actual: {len(all_orders)} transactions, ₹{total_revenue} total")
    print(f"✓ PASS" if len(all_orders) == 3 and total_revenue == 3500 else "✗ FAIL")

if __name__ == "__main__":
    test_deduplication()
