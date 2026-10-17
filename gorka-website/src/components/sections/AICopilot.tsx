"use client";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function AICopilot() {
  const t = useTranslations("aiVision");
  return (
    <section className="section-padding bg-gorka-cream">
      <div className="container-gorka max-w-4xl mx-auto text-center">
        <p className="text-sm font-semibold tracking-widest text-[#F01428] uppercase mb-4">{t("eyebrow")}</p>
        <h2 className="text-3xl md:text-4xl font-bold text-gorka-dark mb-6">{t("title")}</h2>
        <p className="text-lg text-gray-600 mb-12">{t("intro")}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left mb-12">
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-xl font-semibold text-[#F01428] mb-4">{t("todayTitle")}</h3>
            <p className="text-gray-600 leading-relaxed">{t("todayDesc")}</p>
          </div>
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-xl font-semibold text-gorka-violet mb-4">{t("directionTitle")}</h3>
            <p className="text-gray-600 leading-relaxed">{t("directionDesc")}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border-l-4 border-[#F01428] text-left mb-10 shadow-sm">
          <h4 className="font-semibold text-gorka-dark mb-2">{t("privacyTitle")}</h4>
          <p className="text-gray-600 text-sm leading-relaxed">{t("privacyDesc")}</p>
        </div>

        <Link href="/copilot" className="inline-block px-6 py-3 bg-white text-gorka-dark border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition shadow-sm">
          {t("cta")}
        </Link>
      </div>
    </section>
  );
}