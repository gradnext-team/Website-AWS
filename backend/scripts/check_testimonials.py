#!/usr/bin/env python3
"""
Testimonials Database Checker & Migrator

This script helps diagnose and fix testimonial persistence issues.

Usage:
    python3 scripts/check_testimonials.py [command]

Commands:
    check       - Show testimonials in current database
    export      - Export testimonials to JSON file
    import      - Import testimonials from JSON file
    migrate     - Migrate file-based images to MongoDB
    verify      - Verify all testimonials have valid image URLs
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
import sys
import json
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


async def check_testimonials():
    """Check testimonials and images in current database"""
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'gradnext')
    
    print(f"📊 Checking Database: {mongo_url}/{db_name}\n")
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    try:
        # Count testimonials
        total_testimonials = await db.testimonials.count_documents({})
        active_testimonials = await db.testimonials.count_documents({"is_active": True})
        
        print(f"✅ Total Testimonials: {total_testimonials}")
        print(f"✅ Active Testimonials: {active_testimonials}")
        
        # Count persistent images
        total_images = await db.persistent_images.count_documents({})
        testimonial_images = await db.persistent_images.count_documents({"category": "testimonials"})
        
        print(f"✅ Total Persistent Images: {total_images}")
        print(f"✅ Testimonial Images: {testimonial_images}\n")
        
        # List testimonials
        if total_testimonials > 0:
            print("📋 Testimonial List:\n")
            testimonials = await db.testimonials.find({}, {"_id": 0}).to_list(None)
            
            for i, t in enumerate(testimonials, 1):
                status = "✅" if t.get('is_active', True) else "❌"
                image_url = t.get('image_url', 'No image')
                image_status = "🖼️ MongoDB" if image_url.startswith('/api/images/') else "⚠️ File"
                
                print(f"{i}. {status} {t.get('name', 'N/A')}")
                print(f"   Position: {t.get('position', 'N/A')}")
                print(f"   Company: {t.get('company_joined', 'N/A')}")
                print(f"   Image: {image_status} {image_url}")
                print(f"   Pages: {', '.join(t.get('show_on_pages', []))}")
                print()
        else:
            print("⚠️ No testimonials found in database")
            print("\n💡 Tip: Create testimonials via Admin Panel → Testimonials Management")
    
    finally:
        client.close()


async def export_testimonials(filename="testimonials_export.json"):
    """Export testimonials and images to JSON file"""
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'gradnext')
    
    print(f"📤 Exporting from: {mongo_url}/{db_name}")
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    try:
        # Export testimonials
        testimonials = await db.testimonials.find({}, {"_id": 0}).to_list(None)
        
        # Export related images
        image_urls = [t.get('image_url') for t in testimonials if t.get('image_url', '').startswith('/api/images/')]
        image_ids = [url.split('/')[-1] for url in image_urls]
        
        images = []
        if image_ids:
            images = await db.persistent_images.find(
                {"id": {"$in": image_ids}},
                {"_id": 0}
            ).to_list(None)
        
        # Create export data
        export_data = {
            "exported_at": datetime.utcnow().isoformat(),
            "database": db_name,
            "testimonials_count": len(testimonials),
            "images_count": len(images),
            "testimonials": testimonials,
            "persistent_images": images
        }
        
        # Save to file
        with open(filename, 'w') as f:
            json.dump(export_data, f, indent=2)
        
        print(f"✅ Exported {len(testimonials)} testimonials and {len(images)} images")
        print(f"✅ Saved to: {filename}")
        
    finally:
        client.close()


async def import_testimonials(filename="testimonials_export.json"):
    """Import testimonials and images from JSON file"""
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'gradnext')
    
    print(f"📥 Importing to: {mongo_url}/{db_name}")
    
    if not os.path.exists(filename):
        print(f"❌ File not found: {filename}")
        return
    
    with open(filename, 'r') as f:
        import_data = json.load(f)
    
    print(f"📦 Import file created: {import_data['exported_at']}")
    print(f"📦 Contains: {import_data['testimonials_count']} testimonials, {import_data['images_count']} images")
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    try:
        # Check for existing data
        existing_count = await db.testimonials.count_documents({})
        
        if existing_count > 0:
            response = input(f"\n⚠️ Database already has {existing_count} testimonials. Continue? (y/n): ")
            if response.lower() != 'y':
                print("❌ Import cancelled")
                return
        
        # Import images first
        if import_data['persistent_images']:
            for image in import_data['persistent_images']:
                await db.persistent_images.update_one(
                    {"id": image['id']},
                    {"$set": image},
                    upsert=True
                )
            print(f"✅ Imported {len(import_data['persistent_images'])} images")
        
        # Import testimonials
        if import_data['testimonials']:
            for testimonial in import_data['testimonials']:
                await db.testimonials.update_one(
                    {"id": testimonial['id']},
                    {"$set": testimonial},
                    upsert=True
                )
            print(f"✅ Imported {len(import_data['testimonials'])} testimonials")
        
        print("\n✅ Import complete!")
        
    finally:
        client.close()


async def migrate_images():
    """Migrate file-based images to MongoDB"""
    print("🔄 Running image migration...")
    
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'gradnext')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    try:
        from migrations.startup_migrations import migrate_images_to_mongodb
        await migrate_images_to_mongodb(db)
        print("✅ Migration complete")
    except Exception as e:
        print(f"❌ Migration failed: {e}")
    finally:
        client.close()


async def verify_testimonials():
    """Verify all testimonials have valid image URLs"""
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'gradnext')
    
    print(f"🔍 Verifying testimonials in: {mongo_url}/{db_name}\n")
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    try:
        testimonials = await db.testimonials.find({}, {"_id": 0, "id": 1, "name": 1, "image_url": 1}).to_list(None)
        
        if not testimonials:
            print("⚠️ No testimonials to verify")
            return
        
        issues = []
        for t in testimonials:
            image_url = t.get('image_url', '')
            
            if not image_url:
                issues.append(f"❌ {t['name']}: No image URL")
            elif image_url.startswith('/api/uploads/'):
                issues.append(f"⚠️ {t['name']}: Using file storage (should migrate)")
            elif image_url.startswith('/api/images/'):
                # Check if image exists in MongoDB
                image_id = image_url.split('/')[-1]
                exists = await db.persistent_images.find_one({"id": image_id})
                if not exists:
                    issues.append(f"❌ {t['name']}: MongoDB image not found ({image_id})")
                else:
                    print(f"✅ {t['name']}: Valid MongoDB image")
            elif image_url.startswith('http'):
                print(f"🌐 {t['name']}: External image URL")
            else:
                issues.append(f"⚠️ {t['name']}: Unknown image format ({image_url})")
        
        if issues:
            print("\n⚠️ Issues Found:\n")
            for issue in issues:
                print(f"  {issue}")
            print("\n💡 Run 'migrate' command to fix file-based images")
        else:
            print("\n✅ All testimonials verified successfully!")
    
    finally:
        client.close()


async def main():
    """Main function"""
    if len(sys.argv) < 2:
        print(__doc__)
        return
    
    command = sys.argv[1].lower()
    
    if command == "check":
        await check_testimonials()
    elif command == "export":
        filename = sys.argv[2] if len(sys.argv) > 2 else "testimonials_export.json"
        await export_testimonials(filename)
    elif command == "import":
        filename = sys.argv[2] if len(sys.argv) > 2 else "testimonials_export.json"
        await import_testimonials(filename)
    elif command == "migrate":
        await migrate_images()
    elif command == "verify":
        await verify_testimonials()
    else:
        print(f"❌ Unknown command: {command}")
        print(__doc__)


if __name__ == "__main__":
    asyncio.run(main())
