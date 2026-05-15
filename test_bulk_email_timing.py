#!/usr/bin/env python3
"""
Test script to verify bulk email 1-second delay enforcement
"""
import asyncio
import time

async def simulate_bulk_email_send(num_emails=5):
    """Simulate the bulk email sending with timing enforcement"""
    print(f"Testing bulk email timing with {num_emails} emails...\n")
    
    timings = []
    last_send_time = None
    
    for idx in range(1, num_emails + 1):
        # Record current time BEFORE any work
        current_send_time = time.time()
        
        # Record timing if not first email
        if last_send_time is not None:
            gap = current_send_time - last_send_time
            timings.append({
                "email": idx,
                "gap_seconds": round(gap, 3),
                "meets_1s_requirement": gap >= 1.0
            })
            print(f"Email {idx}: Gap from previous = {gap:.3f}s {'✅' if gap >= 1.0 else '❌'}")
        else:
            print(f"Email {idx}: First email (no gap to measure)")
        
        # Update last_send_time IMMEDIATELY after measuring
        last_send_time = current_send_time
        
        # Simulate email send (takes variable time)
        iteration_start = time.time()
        send_duration = 0.1  # Simulate 100ms send time
        await asyncio.sleep(send_duration)
        
        # Enforce 1-second minimum delay before next email
        if idx < num_emails:
            elapsed = time.time() - iteration_start
            if elapsed < 1.0:
                wait_time = 1.0 - elapsed
                print(f"  → Waiting {wait_time:.3f}s to maintain 1-second minimum\n")
                await asyncio.sleep(wait_time)
            else:
                print(f"  → Send took {elapsed:.3f}s, adding 0.1s buffer\n")
                await asyncio.sleep(0.1)
    
    # Summary
    print("\n" + "="*60)
    print("TIMING TEST RESULTS")
    print("="*60)
    print(f"Total emails: {num_emails}")
    print(f"Gaps measured: {len(timings)}")
    
    if timings:
        all_pass = all(t["meets_1s_requirement"] for t in timings)
        print(f"All gaps ≥ 1.0s: {'✅ PASS' if all_pass else '❌ FAIL'}")
        print(f"\nMin gap: {min(t['gap_seconds'] for t in timings):.3f}s")
        print(f"Max gap: {max(t['gap_seconds'] for t in timings):.3f}s")
        print(f"Avg gap: {sum(t['gap_seconds'] for t in timings) / len(timings):.3f}s")
        
        if not all_pass:
            print("\n⚠️  FAILED GAPS:")
            for t in timings:
                if not t["meets_1s_requirement"]:
                    print(f"  Email {t['email']}: {t['gap_seconds']}s")
    
    print("="*60)

if __name__ == "__main__":
    print("🔬 Bulk Email Timing Test\n")
    asyncio.run(simulate_bulk_email_send(5))
