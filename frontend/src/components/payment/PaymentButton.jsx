import React, { useState, useCallback } from 'react';
import { useRazorpay } from 'react-razorpay';
import axios from 'axios';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const PaymentButton = ({ 
  planKey, 
  planName, 
  amount, 
  description,
  onSuccess,
  variant = "default",
  className = "",
  children 
}) => {
  const { error: razorpayError, isLoading: razorpayLoading, Razorpay } = useRazorpay();
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState(null);

  const handlePayment = useCallback(async () => {
    if (!Razorpay) {
      setError("Payment system is loading. Please try again.");
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      // Create order
      const orderResponse = await axios.post(
        `${BACKEND_URL}/api/payments/create-order`,
        { plan_key: planKey },
        { withCredentials: true }
      );

      const { order_id, key_id, user_email, user_name } = orderResponse.data;

      const options = {
        key: key_id,
        amount: amount,
        currency: "INR",
        name: "gradnext",
        description: planName,
        order_id: order_id,
        handler: async (response) => {
          try {
            // Verify payment
            await axios.post(
              `${BACKEND_URL}/api/payments/verify`,
              {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                plan_key: planKey
              },
              { withCredentials: true }
            );

            setShowSuccess(true);
            if (onSuccess) {
              setTimeout(() => {
                onSuccess();
              }, 2000);
            }
          } catch (err) {
            setError("Payment verification failed. Please contact support.");
          }
        },
        prefill: {
          name: user_name,
          email: user_email
        },
        theme: {
          color: "#2563eb"
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
          }
        }
      };

      const razorpayInstance = new Razorpay(options);
      razorpayInstance.on('payment.failed', (response) => {
        setError(`Payment failed: ${response.error.description}`);
        setLoading(false);
      });
      razorpayInstance.open();
      setLoading(false);

    } catch (err) {
      const errorMessage = err.response?.data?.detail || "Failed to initiate payment";
      setError(errorMessage);
      setLoading(false);
    }
  }, [Razorpay, planKey, planName, amount, onSuccess]);

  return (
    <>
      <Button 
        onClick={handlePayment} 
        disabled={loading || razorpayLoading}
        variant={variant}
        className={className}
        data-testid={`payment-btn-${planKey}`}
      >
        {loading || razorpayLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            {razorpayLoading ? 'Loading...' : 'Processing...'}
          </>
        ) : (
          children || `Pay ₹${(amount / 100).toLocaleString('en-IN')}`
        )}
      </Button>

      {/* Error Display */}
      {error && (
        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Success Dialog */}
      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <DialogTitle className="text-center">Payment Successful!</DialogTitle>
            <DialogDescription className="text-center">
              You've successfully upgraded to <strong>{planName}</strong>. 
              Enjoy your new features!
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center mt-4">
            <Button onClick={() => {
              setShowSuccess(false);
              if (onSuccess) onSuccess();
            }}>
              Continue to Dashboard
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PaymentButton;
