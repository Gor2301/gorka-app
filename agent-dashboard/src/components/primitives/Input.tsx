import type { InputHTMLAttributes, Ref } from 'react';
import './Input.css';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  inputRef?: Ref<HTMLInputElement>;
}

export default function Input({ className, inputRef, ...rest }: InputProps) {
  const classes = ['input', className ?? ''].filter(Boolean).join(' ');

  return <input ref={inputRef} className={classes} {...rest} />;
}