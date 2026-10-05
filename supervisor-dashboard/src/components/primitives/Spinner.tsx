import './Spinner.css';

interface SpinnerProps {
  size?: number;
}

export default function Spinner({ size = 40 }: SpinnerProps) {
  return (
    <div
      className="spinner"
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    />
  );
}