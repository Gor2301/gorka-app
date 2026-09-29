import type { HTMLAttributes, ReactNode } from 'react';
import './Card.css';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  children: ReactNode;
}

export default function Card({ title, children, className, ...rest }: CardProps) {
  const classes = ['card', className ?? ''].filter(Boolean).join(' ');

  return (
    <div className={classes} {...rest}>
      {title && <div className="card__title">{title}</div>}
      <div className="card__body">{children}</div>
    </div>
  );
}