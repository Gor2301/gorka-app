import type { TextareaHTMLAttributes, Ref } from 'react';
import './Textarea.css';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  textareaRef?: Ref<HTMLTextAreaElement>;
}

export default function Textarea({ className, textareaRef, ...rest }: TextareaProps) {
  const classes = ['textarea', className ?? ''].filter(Boolean).join(' ');

  return <textarea ref={textareaRef} className={classes} {...rest} />;
}