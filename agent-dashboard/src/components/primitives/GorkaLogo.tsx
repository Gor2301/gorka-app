import './GorkaLogo.css';

interface GorkaLogoProps {
  subtitle?: string;
}

export default function GorkaLogo({ subtitle }: GorkaLogoProps) {
  return (
    <div className="gorka-logo">
      <h1 className="gorka-logo__wordmark">GORKA</h1>
      {subtitle && <p className="gorka-logo__subtitle">{subtitle}</p>}
    </div>
  );
}