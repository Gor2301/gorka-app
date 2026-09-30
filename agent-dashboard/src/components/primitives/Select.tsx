import type { SelectHTMLAttributes, Ref } from 'react';
import './Select.css';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  selectRef?: Ref<HTMLSelectElement>;
}

export default function Select({ className, selectRef, ...rest }: SelectProps) {
  const classes = ['select', className ?? ''].filter(Boolean).join(' ');

  return <select ref={selectRef} className={classes} {...rest} />;
}