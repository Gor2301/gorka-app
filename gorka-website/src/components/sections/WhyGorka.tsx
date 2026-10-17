"use client";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function WhyGorka() {
  const t = useTranslations("whyGorka");
  return (
    <section className="section-padding bg-white">
      <div className="container-gorka max-w-5xl mx-auto text-center">
        <p className="text-sm font-semibold tracking-widest text-[#F01428] uppercase mb-4">{t("eyebrow")}</p>
        <h2 className="text-3xl md:text-4xl font-bold text-gorka-dark mb-6">{t("title")}</h2>
        <p className="text-lg text-gray-600 mb-16 max-w-3xl mx-auto">{t("intro")}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 text-left mb-16">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-gorka-cream p-6 rounded-xl border border-gray-100">
              <h4 className="font-semibold text-gorka-dark mb-2">{t(`point${i}Title` as any)}</h4>
              <p className="text-gray-600 text-sm leading-relaxed">{t(`point${i}Desc` as any)}</p>
            </div>
          ))}
        </div>
        
        <p className="text-gray-700 font-medium mb-8 max-w-3xl mx-auto">{t("conclusion")}</p>
        <Link href="/pricing" className="inline-block px-6 py-3 bg-gorka-violet text-white rounded-lg font-semibold hover:bg-gorka-violet/90 transition shadow-sm">
          {t("cta")}
        </Link>
      </div>
    </section>
  );
}