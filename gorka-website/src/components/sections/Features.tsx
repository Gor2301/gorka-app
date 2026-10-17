"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";

type FeatureItem = {
  number: string;
  category: string;
  headline: string;
  subheadline: string;
  body: string;
};

export default function Features() {
  const t = useTranslations("features");
  const items = t.raw("items") as FeatureItem[];

  return (
    <section className="section-padding bg-gorka-cream">
      <div className="container-gorka">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-gorka-dark mb-16">
          {t("title")}
        </h2>

        <div className="space-y-8">
          {items.map((item, index) => (
            <div
              key={index}
              className="bg-white rounded-2xl shadow-sm hover:shadow-lg transition duration-200 border border-gray-100 overflow-hidden grid grid-cols-1 md:grid-cols-[380px_1fr]"
            >
              {/* Image Column */}
              <div className="relative min-h-[250px] md:min-h-full bg-gray-100">
                <Image
                  src={`/card-0${index + 1}.jpg`}
                  alt={item.category}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 380px"
                />
              </div>

              {/* Text Column */}
              <div className="p-8 md:p-10 flex flex-col justify-center">
                <div className="flex items-center gap-4 mb-4">
                  <div className="text-2xl font-bold text-[#F01428] tracking-wider leading-none">
                    {item.number}
                  </div>
                  <p className="text-xs font-semibold tracking-widest text-[#F01428] uppercase">
                    {item.category}
                  </p>
                </div>

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