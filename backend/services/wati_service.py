"""
Wati WhatsApp Service
Handles sending WhatsApp messages via Wati API
"""
import aiohttp
import logging
import os
from typing import Optional, Dict, List, Any

logger = logging.getLogger(__name__)

class WatiService:
    """Service for sending WhatsApp messages via Wati API"""
    
    def __init__(self):
        self.api_token = os.environ.get('WATI_API_TOKEN', '')
        self.api_endpoint = os.environ.get('WATI_API_ENDPOINT', '')
        self.whatsapp_number = os.environ.get('WATI_WHATSAPP_NUMBER', '')
        self.timeout = aiohttp.ClientTimeout(total=30)
        
        if not self.api_token or not self.api_endpoint:
            logger.warning("Wati credentials not configured")
    
    def _get_headers(self) -> Dict[str, str]:
        """Get headers for Wati API requests"""
        return {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
    
    async def send_template_message(
        self,
        recipient_number: str,
        template_name: str,
        parameters: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """
        Send a WhatsApp template message via Wati
        
        Args:
            recipient_number: Phone number in international format (e.g., +918866007332)
            template_name: Name of the approved template in Wati
            parameters: List of parameter objects with name and value
            
        Returns:
            API response
        """
        if not self.api_token or not self.api_endpoint:
            raise Exception("Wati not configured")
        
        # Ensure phone number is in correct format (no + sign for Wati)
        phone = recipient_number.replace('+', '').replace(' ', '')
        
        # Use query parameter format for single recipient
        url = f"{self.api_endpoint}/api/v1/sendTemplateMessage?whatsappNumber={phone}"
        
        payload = {
            "template_name": template_name,
            "broadcast_name": f"Session Notification {template_name}",
            "parameters": parameters or []
        }
        
        try:
            async with aiohttp.ClientSession(timeout=self.timeout) as session:
                async with session.post(
                    url,
                    json=payload,
                    headers=self._get_headers()
                ) as response:
                    response_text = await response.text()
                    logger.info(f"Wati response status: {response.status}, body: {response_text[:200]}")
                    
                    if response.status not in [200, 201]:
                        logger.error(f"Wati API error: {response.status} - {response_text}")
                        raise Exception(f"Wati API error: {response.status} - {response_text[:500]}")
                    
                    return {"success": True, "status": response.status, "response": response_text}
        except aiohttp.ClientError as e:
            logger.error(f"Wati request failed: {e}")
            raise
        except Exception as e:
            logger.error(f"Wati send_template_message error: {e}")
            raise
    
    async def send_session_message(
        self,
        recipient_number: str,
        message_text: str
    ) -> Dict[str, Any]:
        """
        Send a session message (within 24h window)
        
        Args:
            recipient_number: Phone number
            message_text: Message content
            
        Returns:
            API response
        """
        if not self.api_token or not self.api_endpoint:
            raise Exception("Wati not configured")
        
        url = f"{self.api_endpoint}/api/v1/sendSessionMessage/{self.whatsapp_number}"
        
        phone = recipient_number.replace('+', '').replace(' ', '')
        
        payload = {
            "messageText": message_text
        }
        
        try:
            async with aiohttp.ClientSession(timeout=self.timeout) as session:
                async with session.post(
                    url,
                    json=payload,
                    headers=self._get_headers(),
                    params={"whatsappNumber": phone}
                ) as response:
                    response_text = await response.text()
                    logger.info(f"Wati session message status: {response.status}")
                    
                    if response.status not in [200, 201]:
                        logger.error(f"Wati session message error: {response.status} - {response_text}")
                        raise Exception(f"Wati API error: {response.status}")
                    
                    return {"success": True, "status": response.status}
        except Exception as e:
            logger.error(f"Wati send_session_message error: {e}")
            raise
    
    async def trigger_chatbot(
        self,
        recipient_number: str,
        flow_id: Optional[str] = None,
        flow_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Trigger a chatbot/flow in WATI for a specific contact
        
        Args:
            recipient_number: Phone number in international format
            flow_id: The ID of the flow/chatbot to trigger (optional)
            flow_name: The name of the flow/chatbot to trigger (optional)
            
        Note: You need either flow_id or flow_name. Flow ID is preferred for reliability.
        
        Returns:
            API response
        """
        if not self.api_token or not self.api_endpoint:
            raise Exception("Wati not configured")
        
        phone = recipient_number.replace('+', '').replace(' ', '')
        
        # WATI API endpoint for triggering flows
        url = f"{self.api_endpoint}/api/v1/assignUserToFlow"
        
        payload = {
            "whatsappNumber": phone
        }
        
        # Add flow identifier (ID is preferred over name)
        if flow_id:
            payload["flowId"] = flow_id
        elif flow_name:
            payload["flowName"] = flow_name
        else:
            raise ValueError("Either flow_id or flow_name must be provided")
        
        try:
            async with aiohttp.ClientSession(timeout=self.timeout) as session:
                async with session.post(
                    url,
                    json=payload,
                    headers=self._get_headers()
                ) as response:
                    response_text = await response.text()
                    logger.info(f"Wati trigger chatbot status: {response.status}, response: {response_text[:200]}")
                    
                    if response.status not in [200, 201]:
                        logger.error(f"Wati chatbot trigger error: {response.status} - {response_text}")
                        raise Exception(f"Wati API error: {response.status} - {response_text[:500]}")
                    
                    return {
                        "success": True, 
                        "status": response.status, 
                        "response": response_text,
                        "flow_id": flow_id,
                        "phone": phone
                    }
        except aiohttp.ClientError as e:
            logger.error(f"Wati chatbot trigger request failed: {e}")
            raise
        except Exception as e:
            logger.error(f"Wati trigger_chatbot error: {e}")
            raise
    
    async def update_contact_attribute(
        self,
        recipient_number: str,
        attribute_name: str,
        attribute_value: str
    ) -> Dict[str, Any]:
        """
        Update a custom attribute for a contact in WATI
        
        Args:
            recipient_number: Phone number in international format
            attribute_name: Name of the attribute to update (e.g., "workshop_name")
            attribute_value: Value to set for the attribute
            
        Returns:
            API response
        """
        if not self.api_token or not self.api_endpoint:
            raise Exception("Wati not configured")
        
        phone = recipient_number.replace('+', '').replace(' ', '')
        
        # WATI API endpoint for updating contact attributes
        url = f"{self.api_endpoint}/api/v1/updateContactAttributes/{phone}"
        
        payload = {
            "customParams": [
                {
                    "name": attribute_name,
                    "value": attribute_value
                }
            ]
        }
        
        try:
            async with aiohttp.ClientSession(timeout=self.timeout) as session:
                async with session.post(
                    url,
                    json=payload,
                    headers=self._get_headers()
                ) as response:
                    response_text = await response.text()
                    logger.info(f"Wati update attribute status: {response.status}, response: {response_text[:200]}")
                    
                    if response.status not in [200, 201]:
                        logger.error(f"Wati attribute update error: {response.status} - {response_text}")
                        raise Exception(f"Wati API error: {response.status} - {response_text[:500]}")
                    
                    return {
                        "success": True,
                        "status": response.status,
                        "response": response_text,
                        "phone": phone,
                        "attribute": attribute_name,
                        "value": attribute_value
                    }
        except aiohttp.ClientError as e:
            logger.error(f"Wati attribute update request failed: {e}")
            raise
        except Exception as e:
            logger.error(f"Wati update_contact_attribute error: {e}")
            raise


    async def send_otp_message(
        self,
        recipient_number: str,
        otp: str
    ) -> Dict[str, Any]:
        """
        Send an OTP verification message via WhatsApp.
        Uses template message for first-time contacts (outside 24h window).
        
        Args:
            recipient_number: Phone number in international format (e.g., 918866007332)
            otp: The OTP code to send
            
        Returns:
            API response dict with success status
        """
        if not self.api_token or not self.api_endpoint:
            raise Exception("Wati not configured")
        
        phone = recipient_number.replace('+', '').replace(' ', '').replace('-', '')
        
        # Get template name from env or use default
        otp_template = os.environ.get('WATI_OTP_TEMPLATE', 'otp_verification')
        
        # Try template message first (works outside 24h window)
        try:
            result = await self.send_template_message(
                recipient_number=phone,
                template_name=otp_template,
                parameters=[
                    {"name": "1", "value": otp}
                ]
            )
            logger.info(f"OTP sent via WhatsApp template to {phone[-4:]}")
            return {"success": True, "method": "template", **result}
        except Exception as template_err:
            logger.warning(f"Template OTP failed for {phone[-4:]}: {template_err}")
        
        # Fallback: Try session message (only works within 24h window)
        try:
            message = f"Your GradNext verification code is: *{otp}*\n\nThis code expires in 10 minutes. Do not share this code with anyone."
            result = await self.send_session_message(
                recipient_number=phone,
                message_text=message
            )
            logger.info(f"OTP sent via WhatsApp session message to {phone[-4:]}")
            return {"success": True, "method": "session", **result}
        except Exception as session_err:
            logger.warning(f"Session OTP also failed for {phone[-4:]}: {session_err}")
        
        # Fallback: Try interactive message with text
        try:
            url = f"{self.api_endpoint}/api/v1/sendInteractiveButtonsMessage?whatsappNumber={phone}"
            payload = {
                "header": {
                    "type": "Text",
                    "text": "GradNext Verification"
                },
                "body": f"Your verification code is: *{otp}*\n\nThis code expires in 10 minutes.",
                "footer": "Do not share this code with anyone.",
                "buttons": []
            }
            
            async with aiohttp.ClientSession(timeout=self.timeout) as session:
                async with session.post(
                    url,
                    json=payload,
                    headers=self._get_headers()
                ) as response:
                    response_text = await response.text()
                    if response.status in [200, 201]:
                        logger.info(f"OTP sent via WhatsApp interactive message to {phone[-4:]}")
                        return {"success": True, "method": "interactive"}
                    else:
                        raise Exception(f"Interactive message failed: {response.status}")
        except Exception as interactive_err:
            logger.warning(f"Interactive OTP also failed for {phone[-4:]}: {interactive_err}")
        
        raise Exception(f"All WhatsApp OTP methods failed for {phone[-4:]}")


# Global instance
wati_service = WatiService()
