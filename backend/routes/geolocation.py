"""
Geolocation and Regional Pricing API
Detects user location based on IP and returns appropriate currency/pricing
"""
from fastapi import APIRouter, Request
import httpx
import os
from typing import Dict, Optional

router = APIRouter(prefix="/geolocation", tags=["geolocation"])

# Country code to currency mapping
COUNTRY_CURRENCY_MAP = {
    "IN": "INR",
    "US": "USD",
    "GB": "GBP",
    "DE": "EUR",
    "FR": "EUR",
    "IT": "EUR",
    "ES": "EUR",
    "NL": "EUR",
    "BE": "EUR",
    "AT": "EUR",
    "IE": "EUR",
    "PT": "EUR",
    "GR": "EUR",
    "SG": "SGD",
    "AE": "AED",
    "AU": "AUD",
    "CA": "CAD",
    "NZ": "NZD",
}

# Currency symbols
CURRENCY_SYMBOLS = {
    "INR": "₹",
    "USD": "$",
    "GBP": "£",
    "EUR": "€",
    "SGD": "S$",
    "AED": "AED",
    "AUD": "A$",
    "CAD": "C$",
    "NZD": "NZ$",
}

# Regional groups (for pricing)
REGIONAL_GROUPS = {
    "IN": "IN",
    "US": "US",
    "GB": "GB",
    "AE": "AE",
    "SG": "SG",
    # European countries map to EU
    "DE": "EU",
    "FR": "EU",
    "IT": "EU",
    "ES": "EU",
    "NL": "EU",
    "BE": "EU",
    "AT": "EU",
    "IE": "EU",
    "PT": "EU",
    "GR": "EU",
}


def get_client_ip(request: Request) -> str:
    """Get client IP from request, handling proxies"""
    # Check for forwarded IP (behind proxy/load balancer)
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip
    
    # Fallback to direct connection
    return request.client.host if request.client else "127.0.0.1"


async def detect_country_from_ip(ip: str) -> Optional[str]:
    """Detect country code from IP address using free geolocation API"""
    # Skip for localhost/private IPs
    if ip in ["127.0.0.1", "localhost"] or ip.startswith("192.168.") or ip.startswith("10."):
        return "IN"  # Default to India for local development
    
    try:
        # Using ipapi.co - free tier allows 1000 requests/day
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://ipapi.co/{ip}/json/",
                timeout=5.0
            )
            if response.status_code == 200:
                data = response.json()
                return data.get("country_code", "IN")
    except Exception as e:
        print(f"Geolocation API error: {e}")
    
    # Fallback to India
    return "IN"


@router.get("/detect")
async def detect_location(request: Request):
    """
    Detect user's location based on IP address
    Returns country code, currency, and regional pricing group
    """
    # Get client IP
    client_ip = get_client_ip(request)
    
    # Detect country from IP
    country_code = await detect_country_from_ip(client_ip)
    
    # Get currency for country
    currency = COUNTRY_CURRENCY_MAP.get(country_code, "INR")
    
    # Get regional pricing group
    region = REGIONAL_GROUPS.get(country_code, "DEFAULT")
    
    # Get currency symbol
    symbol = CURRENCY_SYMBOLS.get(currency, "₹")
    
    return {
        "ip": client_ip,
        "country_code": country_code,
        "currency": currency,
        "currency_symbol": symbol,
        "region": region,
        "detected": True
    }


@router.get("/currencies")
async def get_supported_currencies():
    """Get list of supported currencies and their symbols"""
    currency_names = {
        "INR": "Indian Rupee",
        "USD": "US Dollar",
        "GBP": "British Pound",
        "EUR": "Euro",
        "SGD": "Singapore Dollar",
        "AED": "UAE Dirham",
        "AUD": "Australian Dollar",
        "CAD": "Canadian Dollar",
        "NZD": "New Zealand Dollar",
    }
    
    return {
        "currencies": [
            {"code": code, "symbol": symbol, "name": currency_names.get(code, code)}
            for code, symbol in CURRENCY_SYMBOLS.items()
        ],
        "regions": list(REGIONAL_GROUPS.keys())
    }


@router.post("/override")
async def override_currency(request: Request, currency_code: str):
    """
    Allow user to manually override detected currency
    Stores in session/cookie
    """
    # Validate currency
    if currency_code not in CURRENCY_SYMBOLS:
        return {"error": "Invalid currency code"}
    
    # In production, you'd store this in session or cookie
    return {
        "success": True,
        "currency": currency_code,
        "symbol": CURRENCY_SYMBOLS[currency_code]
    }
