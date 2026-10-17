"use client";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function FinalCTA() {
  const t = useTranslations("finalCta");
  return (
    <section className="py-20 bg-gorka-violet text-white text-center px-4">
      <div className="container-gorka max-w-3xl mx-auto">
        <h2 className="text-3xl md:text-5xl font-bold mb-6">{t("title")}</h2>
        <p className="text-lg text-white/80 mb-10">{t("subtitle")}</p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link href="/register" className="px-8 py-3 bg-white text-gorka-violet rounded-lg font-semibold hover:bg-gray-100 transition shadow-md">
            {t("ctaPrimary")}
          </Link>
          <Link href="/pricing" className="px-8 py-3 bg-gorka-violet/50 border border-white/30 text-white rounded-lg font-semibold hover:bg-gorka-violet/80 transition">
            {t("ctaSecondary")}
          </Link>
        </div>
      </div>
    </section>
  );
}