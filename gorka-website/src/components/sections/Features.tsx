"use client";

import { useTranslations } from "next-intl";

type FeatureItem = {
  number: string;
  category: string;
  headline: string;
  subheadline: string;
  body: string;
};

function FeatureIcon({ index }: { index: number }) {
  const svgProps = {
    viewBox: "0 0 40 40",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "w-8 h-8",
  };

  switch (index) {
    case 0:
      return (
        <svg {...svgProps}>
          <rect x="7" y="24" width="7" height="10" rx="1" />
          <rect x="17" y="16" width="7" height="18" rx="1" />
          <rect x="27" y="8" width="7" height="26" rx="1" />
        </svg>
      );
    case 1:
      return (
        <svg {...svgProps}>
          <path d="M20 4 L34 10 V20 C34 28 27 34 20 36 C13 34 6 28 6 20 V10 Z" />
          <circle cx="20" cy="19" r="2.8" />
          <path d="M20 21.8 V27" />
        </svg>
      );
    case 2:
      return (
        <svg {...svgProps}>
          <path d="M20 4 L23 16 L35 19 L23 22 L20 34 L17 22 L5 19 L17 16 Z" />
        </svg>
      );
    case 3:
      return (
        <svg {...svgProps}>
          <path d="M21 4 H34 A2 2 0 0 1 36 6 V19 A2 2 0 0 1 35.4 20.4 L20.4 35.4 A2 2 0 0 1 17.6 35.4 L4.6 22.4 A2 2 0 0 1 4.6 19.6 L19.6 4.6 A2 2 0 0 1 21 4 Z" />
          <circle cx="29" cy="11" r="2.2" />
        </svg>
      );
    case 4:
      return (
        <svg {...svgProps}>
          <circle cx="15" cy="20" r="10" />
          <circle cx="25" cy="20" r="10" />
        </svg>
      );
    default:
      return null;
  }
}

export default function Features() {
  const t = useTranslations("features");
  const items = t.raw("items") as FeatureItem[];

  return (
    <section className="section-padding bg-gorka-cream">
      <div className="container-gorka">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-gorka-dark mb-16">
          {t("title")}
        </h2>

        <div className="space-y-6">
          {items.map((item, index) => (
            <div
              key={index}
              className="bg-white rounded-2xl p-8 md:p-10 shadow-sm hover:shadow-lg transition duration-200 border border-gray-100 grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6 md:gap-12"
            >
              <div className="flex md:flex-col items-center md:items-start gap-4 md:gap-6">
                <div className="w-16 h-16 rounded-xl bg-[#F01428]/10 flex items-center justify-center text-[#F01428] shrink-0">
                  <FeatureIcon index={index} />
                </div>
                <div>
                  <div className="text-2xl font-bold text-[#F01428] tracking-wider leading-none mb-1">
                    {item.number}
                  </div>
                  <p className="text-xs font-semibold tracking-widest text-[#F01428] uppercase">
                    {item.category}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-2xl md:text-3xl font-semibold text-gorka-dark mb-3 leading-snug">
                  {item.headline}
                </h3>
                <p className="text-base text-gray-500 font-medium mb-5">
                  {item.subheadline}
                </p>
                <p className="text-gray-600 text-base leading-relaxed max-w-3xl">
                  {item.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}