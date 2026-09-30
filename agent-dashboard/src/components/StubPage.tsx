import type { ReactNode } from 'react';
import './StubPage.css';

interface StubPageProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}

export default function StubPage({
  title,
  subtitle,
  children,
}: StubPageProps) {
  return (
    <div className="stub-page">
      <h2 className="stub-page__title">{title}</h2>
      {subtitle && <p className="stub-page__subtitle">{subtitle}</p>}
      {children}
    </div>
  );
}