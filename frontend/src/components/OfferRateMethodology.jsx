import React, { useState } from 'react';
import { Info, CheckCircle2, XCircle, MinusCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

const OfferRateMethodology = ({ children, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Trigger - wraps children or shows default button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`inline-flex items-center gap-1 text-xs hover:underline transition-all ${className}`}
        style={{ color: 'var(--gn-periwinkle)' }}
      >
        {children || (
          <>
            <Info className="w-3 h-3" />
            How is this calculated?
          </>
        )}
      </button>

      {/* Methodology Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg" style={{ color: 'var(--gn-rhino)' }}>
              <Info className="w-5 h-5" style={{ color: 'var(--gn-periwinkle)' }} />
              How We Calculate Our Offer Rate
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-4 space-y-6">
            {/* Success Definition */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full flex items-center justify-center bg-green-100">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                </div>
                <h3 className="font-semibold" style={{ color: 'var(--gn-rhino)' }}>Counted as Successful</h3>
              </div>
              <div className="pl-8">
                <p className="text-sm" style={{ color: 'var(--gn-grey-dark)' }}>
                  Anyone who completed our coaching program and received and accepted an offer from a consulting firm or another firm they were preparing to target.
                </p>
              </div>
            </div>

            {/* Not Success Definition */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full flex items-center justify-center bg-red-100">
                  <XCircle className="w-4 h-4 text-red-600" />
                </div>
                <h3 className="font-semibold" style={{ color: 'var(--gn-rhino)' }}>Counted as Unsuccessful</h3>
              </div>
              <ul className="pl-8 space-y-2">
                <li className="flex items-start gap-2 text-sm" style={{ color: 'var(--gn-grey-dark)' }}>
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0"></span>
                  <span>Participants who enrolled in any coaching program with an interview already scheduled but did not pass it</span>
                </li>
                <li className="flex items-start gap-2 text-sm" style={{ color: 'var(--gn-grey-dark)' }}>
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0"></span>
                  <span>Participants who enrolled in Full Prep or Pinnacle without an interview, and either never received an interview call or did not pass their interview</span>
                </li>
              </ul>
            </div>

            {/* Not Included */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full flex items-center justify-center bg-slate-100">
                  <MinusCircle className="w-4 h-4 text-slate-500" />
                </div>
                <h3 className="font-semibold" style={{ color: 'var(--gn-rhino)' }}>Excluded from This Calculation</h3>
              </div>
              <ul className="pl-8 space-y-2">
                <li className="flex items-start gap-2 text-sm" style={{ color: 'var(--gn-grey-dark)' }}>
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0"></span>
                  <span>Participants who did not complete their program</span>
                </li>
                <li className="flex items-start gap-2 text-sm" style={{ color: 'var(--gn-grey-dark)' }}>
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0"></span>
                  <span>Those who enrolled to develop general problem-solving skills rather than to prepare for a specific interview</span>
                </li>
                <li className="flex items-start gap-2 text-sm" style={{ color: 'var(--gn-grey-dark)' }}>
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0"></span>
                  <span>Those who had an interview scheduled at enrollment, but the interview was later canceled</span>
                </li>
              </ul>
            </div>

            {/* Transparency Note */}
            <div className="mt-6 p-4 rounded-lg" style={{ backgroundColor: 'var(--gn-periwinkle-lighter)', border: '1px solid var(--gn-periwinkle)' }}>
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--gn-periwinkle)' }} />
                <div>
                  <p className="text-sm font-medium mb-1" style={{ color: 'var(--gn-rhino)' }}>Why We Share This</p>
                  <p className="text-sm" style={{ color: 'var(--gn-grey-dark)' }}>
                    The typical MBB conversion rate is approximately 1% from total applications. We believe in maintaining complete transparency with our community, which is why we share our detailed methodology for calculating the offer rate.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default OfferRateMethodology;
