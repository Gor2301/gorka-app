import type { LabelHTMLAttributes, ReactNode } from 'react';
import './Label.css';

interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  children: ReactNode;
}

export default function Label({ children, className, ...rest }: LabelProps) {
  const classes = ['label', className ?? ''].filter(Boolean).join(' ');

  return (
    <label className={classes} {...rest}>
      {children}
    </label>
  );
}