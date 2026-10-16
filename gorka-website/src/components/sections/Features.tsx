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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item, index) => (
            <div
              key={index}
              className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-lg transition duration-200 border border-gray-100 flex flex-col"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="w-14 h-14 rounded-xl bg-[#F01428]/10 flex items-center justify-center text-[#F01428]">
                  <FeatureIcon index={index} />
                </div>
                <span className="text-sm font-semibold text-[#F01428] tracking-wider">
                  {item.number}
                </span>
              </div>

              <p className="text-xs font-semibold tracking-widest text-[#F01428] uppercase mb-3">
                {item.category}
              </p>

              <h3 className="text-xl font-semibold text-gorka-dark mb-2 leading-snug">
                {item.headline}
              </h3>

              <p className="text-sm text-gray-500 font-medium mb-4">
                {item.subheadline}
              </p>

              <p className="text-gray-600 text-sm leading-relaxed">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}