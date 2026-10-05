import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import './Modal.css';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  closeOnOverlayClick?: boolean;
}

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  closeOnOverlayClick = true,
}: ModalProps) {
  if (!open) return null;

  return (
    <div
      className="modal__overlay"
      onClick={closeOnOverlayClick ? onClose : undefined}
    >
      <div className="modal__box" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="modal__close"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={20} strokeWidth={1.7} />
        </button>
        {title && <div className="modal__title">{title}</div>}
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </div>
  );
}