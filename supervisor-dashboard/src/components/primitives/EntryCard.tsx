import type { ReactNode } from 'react';
import './EntryCard.css';

interface EntryCardProps {
  children: ReactNode;
}

export default function EntryCard({ children }: EntryCardProps) {
  return (
    <div className="entry-backdrop">
      <div className="entry-card">{children}</div>
    </div>
  );
}