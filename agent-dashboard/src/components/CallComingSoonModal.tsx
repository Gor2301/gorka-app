import { X } from 'lucide-react';
import { Button } from '@/components/primitives';
import './CallComingSoonModal.css';

interface CallComingSoonModalProps {
  onClose: () => void;
}

export default function CallComingSoonModal({ onClose }: CallComingSoonModalProps) {
  return (
    <div className="call-coming-soon-modal__overlay">
      <div className="call-coming-soon-modal">
        <div className="call-coming-soon-modal__header">
          <h2 className="call-coming-soon-modal__title">Voice calling</h2>
          <button
            type="button"
            className="call-coming-soon-modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="call-coming-soon-modal__body">
          <p className="call-coming-soon-modal__text">
            Voice calling is coming soon. To place a call today, use your own phone.
          </p>
        </div>
        <div className="call-coming-soon-modal__footer">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}