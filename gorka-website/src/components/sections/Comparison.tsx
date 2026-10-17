"use client";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function Comparison() {
  const t = useTranslations("comparison");
  return (
    <section className="section-padding bg-gorka-cream">
      <div className="container-gorka max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-sm font-semibold tracking-widest text-[#F01428] uppercase mb-4">{t("eyebrow")}</p>
          <h2 className="text-3xl md:text-4xl font-bold text-gorka-dark mb-4">{t("title")}</h2>
          <p className="text-gray-600 max-w-3xl mx-auto">{t("intro")}</p>
        </div>

        <div className="overflow-x-auto bg-white rounded-2xl shadow-sm border border-gray-100 mb-12">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gorka-dark text-white">
                <th className="p-4 md:p-6 font-semibold w-1/4">{t("tableHeaderFeature")}</th>
                <th className="p-4 md:p-6 font-semibold w-3/8 text-[#F01428] bg-gray-900">{t("tableHeaderGorka")}</th>
                <th className="p-4 md:p-6 font-semibold w-3/8">{t("tableHeaderOther")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <tr key={i} className="hover:bg-gray-50 transition">
                  <td className="p-4 md:p-6 font-medium text-gorka-dark">{t(`row${i}Label` as any)}</td>
                  <td className="p-4 md:p-6 text-gray-700 bg-gray-50/50">{t(`row${i}Gorka` as any)}</td>
                  <td className="p-4 md:p-6 text-gray-500">{t(`row${i}Other` as any)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="text-center">
          <h3 className="text-xl font-bold text-gorka-dark mb-3">{t("conclusionTitle")}</h3>
          <p className="text-gray-600 mb-8 max-w-3xl mx-auto">{t("conclusionDesc")}</p>
          <Link href="/pricing" className="inline-block px-8 py-3 bg-gorka-violet text-white rounded-lg font-semibold hover:bg-gorka-violet/90 transition shadow-sm">
            {t("cta")}
          </Link>
        </div>
      </div>
    </section>
  );
}